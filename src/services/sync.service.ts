import {
  Client,
  Guild,
  GuildMember,
  EmbedBuilder,
  TextChannel
} from "discord.js";

import { addSyncLog, getLinkedUser, updateLinkedUser } from "./database.service.js";
import { sendSyncNotification } from "./dm.service.js";

import type { SyncResult } from "../types/index.js";

// Marca os membros cujos cargos o PRÓPRIO bot está alterando, para que o
// anti-tampering (guildMemberUpdate) não confunda uma sincronização legítima
// com manipulação manual. Janela curta cobre a latência do gateway.
const botManagedSyncs = new Map<string, number>();
const BOT_SYNC_WINDOW_MS = 5000;

export function isBotManagedSync(discordId: string): boolean {
  const expiry = botManagedSyncs.get(discordId);

  if (!expiry) {
    return false;
  }

  if (Date.now() > expiry) {
    botManagedSyncs.delete(discordId);
    return false;
  }

  return true;
}

export async function syncUserRoles(
  member: GuildMember,
  plan: string,
  previousPlan?: string
): Promise<SyncResult> {
  try {
    // Sinaliza que este membro está sendo sincronizado pelo bot agora.
    botManagedSyncs.set(member.id, Date.now() + BOT_SYNC_WINDOW_MS);

    // Limpeza proativa para o Map não crescer indefinidamente: agenda a remoção
    // após a janela, mas só remove se a entrada atual já expirou (não apaga uma
    // marcação renovada por um sync mais recente).
    setTimeout(() => {
      const expiry = botManagedSyncs.get(member.id);
      if (expiry !== undefined && Date.now() >= expiry) {
        botManagedSyncs.delete(member.id);
      }
    }, BOT_SYNC_WINDOW_MS + 1000).unref();

    const weeklyRoleId = process.env.ROLE_WEEKLY_ID;
    const monthlyRoleId = process.env.ROLE_MONTHLY_ID;
    const yearlyRoleId = process.env.ROLE_YEARLY_ID;
    const lifetimeRoleId = process.env.ROLE_LIFETIME_ID;

    // Só mexe em cargos que existem NESTA guild. Um ID obsoleto no env (cargo apagado/recriado)
    // faz o Discord retornar "Unknown Role" e derrubaria o sync inteiro — aqui a gente ignora.
    const guildRoles = member.guild.roles.cache;
    const existsHere = (id?: string): id is string => !!id && guildRoles.has(id);

    const allRoleIds = [weeklyRoleId, monthlyRoleId, yearlyRoleId, lifetimeRoleId].filter(existsHere);

    if (allRoleIds.length > 0) {
      await member.roles.remove(allRoleIds);
    }

    let roleToAdd: string | null = null;

    switch (plan) {
      case "WEEKLY":
        roleToAdd = weeklyRoleId || null;
        break;
      case "MONTHLY":
        roleToAdd = monthlyRoleId || null;
        break;
      case "YEARLY":
        roleToAdd = yearlyRoleId || null;
        break;
      case "LIFETIME":
        roleToAdd = lifetimeRoleId || null;
        break;
      case "FREE":
        roleToAdd = null;
        break;
    }

    // Cargo do plano configurado mas inexistente na guild: avisa e não tenta adicionar (evita o crash).
    if (roleToAdd && !guildRoles.has(roleToAdd)) {
      console.warn(
        `[SYNC] Cargo do plano ${plan} (id ${roleToAdd}) não existe na guild ${member.guild.name} — pulei. Confira ROLE_${plan}_ID.`
      );
      roleToAdd = null;
    }

    let action: SyncResult["action"] = "NO_ACTION";

    if (roleToAdd) {
      await member.roles.add(roleToAdd);
      action = previousPlan ? "UPDATED_ROLE" : "ADDED_ROLE";
    } else if (previousPlan) {
      action = "REMOVED_ROLE";
    }

    return {
      success: true,
      action: action,
      reason: `Cargo sincronizado para plano ${plan}`
    };
  } catch (error: any) {
    console.error(
      `[SYNC] Erro ao sincronizar roles para ${member.user.tag}:`,
      error.message
    );
    return {
      success: false,
      reason: error.message
    };
  }
}

export async function syncUserRolesInAllGuilds(
  client: Client,
  discordId: string,
  plan: string,
  previousPlan?: string
): Promise<{ guild: Guild; result: SyncResult }[]> {
  const results: { guild: Guild; result: SyncResult }[] = [];

  for (const [, guild] of client.guilds.cache) {
    try {
      const member = await guild.members.fetch(discordId).catch(() => null);

      if (!member) {
        continue;
      }

      const result = await syncUserRoles(member, plan, previousPlan);
      results.push({ guild, result });

      await logSyncAction(guild, {
        discordId,
        action: `ROLE_SYNC_${result.action}`,
        reason: result.reason,
        success: result.success
      });
    } catch (error: any) {
      console.error(
        `[SYNC] Erro ao sincronizar ${discordId} na guild ${guild.name}:`,
        error.message
      );
      results.push({
        guild,
        result: {
          success: false,
          reason: error.message
        }
      });
    }
  }

  return results;
}

export async function logSyncAction(
  guild: Guild,
  details: {
    discordId?: string;
    action: string;
    reason?: string;
    success: boolean;
  }
): Promise<void> {
  try {
    const logChannelId = process.env.DISCORD_SYNC_LOG_CHANNEL_ID;

    if (!logChannelId) {
      console.warn("[LOGS] DISCORD_SYNC_LOG_CHANNEL_ID não configurado.");
      return;
    }

    const channel = guild.channels.cache.get(logChannelId);

    if (!channel || !(channel instanceof TextChannel)) {
      console.warn("[LOGS] Canal de logs não encontrado.", logChannelId);
      return;
    }

    const embed = createLogEmbed(details);

    await channel.send({ embeds: [embed] });
  } catch (error: any) {
    console.error("[LOGS] Erro ao enviar log:", error.message);
  }
}

function createLogEmbed(details: {
  discordId?: string;
  action: string;
  reason?: string;
  success: boolean;
}): EmbedBuilder {
  const color = details.success ? 0x00ff00 : 0xff0000;
  const status = details.success ? "✅" : "❌";

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${status} ${details.action}`)
    .setFields(
      {
        name: "Discord ID",
        value: details.discordId || "N/A",
        inline: true
      },
      {
        name: "Status",
        value: details.success ? "Sucesso" : "Falha",
        inline: true
      }
    )
    .setFooter({
      text: "TL Optimizer • Sincronização"
    })
    .setTimestamp();

  if (details.reason) {
    embed.setDescription(details.reason);
  }

  return embed;
}
