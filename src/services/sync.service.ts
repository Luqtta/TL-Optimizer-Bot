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

// Sinaliza que este membro está sendo sincronizado pelo bot agora (plano ou Playbook).
function markBotManaged(discordId: string): void {
  botManagedSyncs.set(discordId, Date.now() + BOT_SYNC_WINDOW_MS);

  // Limpeza proativa para o Map não crescer indefinidamente: agenda a remoção
  // após a janela, mas só remove se a entrada atual já expirou (não apaga uma
  // marcação renovada por um sync mais recente).
  setTimeout(() => {
    const expiry = botManagedSyncs.get(discordId);
    if (expiry !== undefined && Date.now() >= expiry) {
      botManagedSyncs.delete(discordId);
    }
  }, BOT_SYNC_WINDOW_MS + 1000).unref();
}

export async function syncUserRoles(
  member: GuildMember,
  plan: string,
  previousPlan?: string
): Promise<SyncResult> {
  try {
    markBotManaged(member.id);

    const weeklyRoleId = process.env.ROLE_WEEKLY_ID;
    const monthlyRoleId = process.env.ROLE_MONTHLY_ID;
    const quarterlyRoleId = process.env.ROLE_QUARTERLY_ID;
    const yearlyRoleId = process.env.ROLE_YEARLY_ID;
    const lifetimeRoleId = process.env.ROLE_LIFETIME_ID;

    // Só mexe em cargos que existem NESTA guild. Um ID obsoleto no env (cargo apagado/recriado)
    // faz o Discord retornar "Unknown Role" e derrubaria o sync inteiro — aqui a gente ignora.
    const guildRoles = member.guild.roles.cache;
    const existsHere = (id?: string): id is string => !!id && guildRoles.has(id);

    const allRoleIds = [weeklyRoleId, monthlyRoleId, quarterlyRoleId, yearlyRoleId, lifetimeRoleId].filter(existsHere);

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
      case "QUARTERLY":
        roleToAdd = quarterlyRoleId || null;
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

    // Plano PAGO sem cargo resolvido = variavel de ambiente ausente. Sem este aviso o efeito e'
    // IDENTICO ao de um plano desconhecido: roleToAdd null, acao NO_ACTION, e o painel mostrando
    // "Cargo sincronizado / Sucesso" enquanto o assinante nao recebe nada. Foi assim que o cargo do
    // trimestral ficou faltando sem ninguem perceber.
    if (!roleToAdd && plan !== "FREE") {
      console.warn(
        `[SYNC] Plano ${plan} sem cargo configurado (ROLE_${plan}_ID ausente no ambiente). ` +
        `Nenhum cargo aplicado a ${member.id} em ${member.guild.name}.`
      );
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

// ---- Estado atual -> cargo de plano ----
// O vinculo e' permanente (so' sai no /desvincular ou com a conta apagada); os cargos seguem o estado ATUAL. Plano
// so' da' cargo ACTIVE ou CANCELED (cancelado vale ate' vencer). EXPIRED/INACTIVE = vinculado e sem cargo de plano.
// status ausente (evento antigo reprocessado, sem o campo) = confia no plano, como antes.
export function rolePlan(plan: string | null | undefined, status: string | null | undefined): string {
  if (!plan) return "FREE";
  if (status === undefined || status === null) return plan;
  return status === "ACTIVE" || status === "CANCELED" ? plan : "FREE";
}

// Status do registro local (o CHECK da tabela so' aceita estes tres).
export function localStatus(status: string | null | undefined): "ACTIVE" | "CANCELED" | "EXPIRED" {
  return status === "ACTIVE" || status === "CANCELED" ? status : "EXPIRED";
}

// ---- Cargo do TL Playbook ----
// INDEPENDENTE dos cargos de plano: só a posse do Playbook decide (eventos PLAYBOOK_*, vínculo, reconcile e
// anti-tamper). O syncUserRoles (plano) nunca toca nele: troca de plano, EXPIRED, upgrade e renovação não o tiram.
export function playbookRoleId(): string | null {
  const id = process.env.ROLE_PLAYBOOK_ID;
  if (!id) return null;
  const planIds = [process.env.ROLE_WEEKLY_ID, process.env.ROLE_MONTHLY_ID, process.env.ROLE_QUARTERLY_ID,
    process.env.ROLE_YEARLY_ID, process.env.ROLE_LIFETIME_ID];
  if (planIds.includes(id)) {
    // O sync de plano tiraria o cargo a cada troca de plano: melhor não dar do que dar e tirar.
    console.error("[SYNC] ROLE_PLAYBOOK_ID é igual a um cargo de plano. Cargo do Playbook desligado até corrigir.");
    return null;
  }
  return id;
}

export async function syncPlaybookRole(member: GuildMember, owns: boolean): Promise<SyncResult> {
  const roleId = playbookRoleId();
  if (!roleId) {
    return { success: true, action: "NO_ACTION", reason: "ROLE_PLAYBOOK_ID ausente ou inválido" };
  }
  if (!member.guild.roles.cache.has(roleId)) {
    console.warn(`[SYNC] Cargo do Playbook (id ${roleId}) não existe na guild ${member.guild.name}. Confira ROLE_PLAYBOOK_ID.`);
    return { success: true, action: "NO_ACTION", reason: "Cargo do Playbook não existe nesta guild" };
  }
  if (member.roles.cache.has(roleId) === owns) {
    return { success: true, action: "NO_ACTION", reason: `Cargo TL Playbook já ${owns ? "presente" : "ausente"}` };
  }
  try {
    markBotManaged(member.id);
    if (owns) {
      await member.roles.add(roleId);
    } else {
      await member.roles.remove(roleId);
    }
    return {
      success: true,
      action: owns ? "ADDED_ROLE" : "REMOVED_ROLE",
      reason: `Cargo TL Playbook ${owns ? "concedido" : "removido"}`
    };
  } catch (error: any) {
    console.error(`[SYNC] Erro no cargo do Playbook para ${member.user.tag}:`, error.message);
    return { success: false, reason: error.message };
  }
}

export async function syncPlaybookRoleInAllGuilds(
  client: Client,
  discordId: string,
  owns: boolean
): Promise<void> {
  for (const [, guild] of client.guilds.cache) {
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      console.warn(`[SYNC] Membro ${discordId} não encontrado em ${guild.name}: cargo do Playbook NÃO aplicado.`);
      continue;
    }
    const result = await syncPlaybookRole(member, owns);
    if (result.action !== "NO_ACTION" || !result.success) {
      await logSyncAction(guild, {
        discordId,
        action: `PLAYBOOK_ROLE_${result.action ?? "ERROR"}`,
        reason: result.reason,
        success: result.success
      });
    }
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
        // NAO e' so' "saiu do servidor": sem o intent GUILD_MEMBERS o fetch falha pra QUALQUER
        // membro fora do cache, e o cargo simplesmente nao e' dado. Antes isto passava mudo, e a
        // unica forma de descobrir era alguem reclamar que assinou e nao ganhou cargo.
        console.warn(
          `[SYNC] Membro ${discordId} nao encontrado em ${guild.name} (fora do servidor, ou intent ` +
          `GUILD_MEMBERS ausente: PRIVILEGED_INTENTS=${process.env.PRIVILEGED_INTENTS ?? "false"}). Cargo NAO aplicado.`
        );
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
