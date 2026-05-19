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

export async function syncUserRoles(
  member: GuildMember,
  plan: string,
  previousPlan?: string
): Promise<SyncResult> {
  try {
    const monthlyRoleId = process.env.ROLE_MONTHLY_ID;
    const yearlyRoleId = process.env.ROLE_YEARLY_ID;
    const lifetimeRoleId = process.env.ROLE_LIFETIME_ID;

    const allRoleIds = [monthlyRoleId, yearlyRoleId, lifetimeRoleId].filter(
      Boolean
    ) as string[];

    await member.roles.remove(allRoleIds);

    let roleToAdd: string | null = null;

    switch (plan) {
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
      text: "LS Optimizer • Sincronização"
    })
    .setTimestamp();

  if (details.reason) {
    embed.setDescription(details.reason);
  }

  return embed;
}
