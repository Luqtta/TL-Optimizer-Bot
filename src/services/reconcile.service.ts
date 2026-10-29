import {
  Client,
  EmbedBuilder,
  TextChannel
} from "discord.js";

import { addSyncLog, getLinkedUser, updateLinkedUser } from "./database.service.js";
import { syncUserRoles, syncPlaybookRole } from "./sync.service.js";

// QUARTERLY = plano Trimestral. O backend manda "QUARTERLY" cru; so' o ANUAL e' traduzido
// pra "YEARLY" na saida dele (DiscordSyncNotifier.planLabel), por vocabulario historico do bot.
type PlanName = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "LIFETIME" | "FREE";

interface BackendLink {
  discordId: string;
  plan: PlanName;
  status: "ACTIVE" | "CANCELED" | "EXPIRED";
  // Posse ativa do TL Playbook (backend). Cargo próprio, reconciliado à parte do plano.
  playbook: boolean;
}

const BATCH_SIZE = 5; // quantos membros reconciliar em paralelo
const PAGE_SIZE = 100; // quantos vínculos buscar por página no backend
const MAX_PAGES = 1000; // trava de segurança contra paginação quebrada (100k)
const RECONCILE_INTERVAL = 30 * 60 * 1000; // 30 minutos

let reconcileScheduler: NodeJS.Timeout | null = null;

export function startReconcileScheduler(client: Client): void {
  if (reconcileScheduler) {
    console.warn("[RECONCILE] Scheduler já está ativo.");
    return;
  }

  console.log("[RECONCILE] Iniciando scheduler de reconciliação...");

  reconcileScheduler = setInterval(async () => {
    try {
      await runReconciliation(client);
    } catch (error: any) {
      console.error("[RECONCILE] Erro na reconciliação:", error.message);
      await notifyReconcileError(client, error);
    }
  }, RECONCILE_INTERVAL);

  console.log(
    `[RECONCILE] Scheduler iniciado. Próxima reconciliação em 30 minutos.`
  );
}

export function stopReconcileScheduler(): void {
  if (reconcileScheduler) {
    clearInterval(reconcileScheduler);
    reconcileScheduler = null;
    console.log("[RECONCILE] Scheduler parado.");
  }
}

// Busca UMA página de vínculos no backend (a fonte da verdade). Paginado de
// propósito: cada página é processada e descartada, então o pico de memória por
// ciclo é pequeno e nada acumula entre execuções.
async function fetchLinksPage(
  offset: number,
  limit: number
): Promise<{ links: BackendLink[]; total: number | null }> {
  // Timeout + retry: uma oscilação do backend não pode abortar o ciclo inteiro.
  let response: Response | undefined;
  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(
        `${process.env.TL_API_URL}/discord/links?limit=${limit}&offset=${offset}`,
        {
          method: "GET",
          headers: {
            "X-Bot-Api-Key": process.env.DISCORD_BOT_API_KEY || ""
          },
          signal: AbortSignal.timeout(15000)
        }
      );

      if (response.ok) {
        break;
      }

      lastError = new Error(
        `Backend /discord/links retornou ${response.status}`
      );
      response = undefined;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }

  if (!response) {
    throw lastError;
  }

  const data = await response.json();
  const raw = Array.isArray(data) ? data : data.links ?? data.users ?? [];

  const links: BackendLink[] = raw
    .map((u: any) => ({
      discordId: u.discordId,
      plan: (u.plan ?? "FREE") as PlanName,
      // Tolera os dois nomes de campo (status / subscriptionStatus).
      status: (u.status ?? u.subscriptionStatus ?? "ACTIVE") as BackendLink["status"],
      playbook: u.playbook === true
    }))
    .filter((l: BackendLink) => Boolean(l.discordId));

  const total = typeof data?.total === "number" ? data.total : null;

  return { links, total };
}

function desiredRoleId(plan: PlanName): string | null {
  switch (plan) {
    case "WEEKLY":
      return process.env.ROLE_WEEKLY_ID ?? null;
    case "MONTHLY":
      return process.env.ROLE_MONTHLY_ID ?? null;
    case "QUARTERLY":
      return process.env.ROLE_QUARTERLY_ID ?? null;
    case "YEARLY":
      return process.env.ROLE_YEARLY_ID ?? null;
    case "LIFETIME":
      return process.env.ROLE_LIFETIME_ID ?? null;
    default:
      return null;
  }
}

function planRoleIds(): string[] {
  return [
    process.env.ROLE_WEEKLY_ID,
    process.env.ROLE_MONTHLY_ID,
    process.env.ROLE_QUARTERLY_ID,
    process.env.ROLE_YEARLY_ID,
    process.env.ROLE_LIFETIME_ID
  ].filter(Boolean) as string[];
}

// Só EXPIRED remove o cargo. CANCELED mantém até o vencimento (o backend já
// devolve EXPIRED quando expira de fato); ACTIVE mantém o plano.
function targetPlan(link: BackendLink): PlanName {
  return link.status === "EXPIRED" ? "FREE" : link.plan || "FREE";
}

// Reconcilia UM vínculo. Só mexe nos cargos quando há divergência — assim não
// floda a API do Discord nem dispara eventos à toa em quem já está correto.
// Quantos vinculos o reconcile NAO conseguiu sequer olhar na rodada atual. Sem isto o resumo
// dizia "0 correcoes" tanto quando estava tudo certo quanto quando nao deu pra checar NINGUEM —
// que e' o que acontece sem o intent GUILD_MEMBERS. Dois cenarios opostos, mesma linha de log.
let membrosNaoEncontrados = 0;

async function reconcileLink(
  client: Client,
  link: BackendLink
): Promise<boolean> {
  const plan = targetPlan(link);
  const desired = desiredRoleId(plan);
  const allIds = planRoleIds();
  let corrected = false;

  // A flag local é o que o anti-tamper consulta: mantém igual à do backend.
  const local = getLinkedUser(link.discordId);
  if (local && local.playbook !== link.playbook) {
    updateLinkedUser(link.discordId, { playbook: link.playbook });
  }

  for (const [, guild] of client.guilds.cache) {
    const member = await guild.members.fetch(link.discordId).catch(() => null);

    if (!member) {
      // Contabiliza pra o resumo final nao dizer "0 correcoes" quando na verdade foi
      // "nao consegui olhar ninguem". Sem o intent GUILD_MEMBERS isso acontece com TODOS.
      membrosNaoEncontrados++;
      continue;
    }

    const alreadyCorrect = allIds.every(
      (id) => member.roles.cache.has(id) === (id === desired)
    );

    if (!alreadyCorrect) {
      const result = await syncUserRoles(member, plan);

      if (result.success) {
        corrected = true;
        addSyncLog({
          discordId: link.discordId,
          action: `RECONCILE_${plan === "FREE" ? "REMOVED" : "SET"}`,
          reason: `Cargo reconciliado para ${plan} (status backend: ${link.status})`,
          success: true
        });
      }
    }

    // Cargo do Playbook: só pela posse, independente do plano. NO_ACTION quando já está certo.
    const pb = await syncPlaybookRole(member, link.playbook);
    if (pb.success && pb.action !== "NO_ACTION") {
      corrected = true;
      addSyncLog({
        discordId: link.discordId,
        action: `RECONCILE_PLAYBOOK_${link.playbook ? "SET" : "REMOVED"}`,
        reason: pb.reason,
        success: true
      });
    }
  }

  return corrected;
}

async function runReconciliation(client: Client): Promise<void> {
  console.log("[RECONCILE] Iniciando reconciliação (fonte: backend)...");
  const startTime = Date.now();

  let offset = 0;
  let page = 0;
  let processed = 0;
  let corrected = 0;
  membrosNaoEncontrados = 0;
  let total: number | null = null;

  while (page < MAX_PAGES) {
    const result = await fetchLinksPage(offset, PAGE_SIZE);
    total = result.total;

    if (result.links.length === 0) {
      break;
    }

    for (let i = 0; i < result.links.length; i += BATCH_SIZE) {
      const batch = result.links.slice(i, i + BATCH_SIZE);

      const outcomes = await Promise.all(
        batch.map(async (link) => {
          try {
            return await reconcileLink(client, link);
          } catch (error: any) {
            console.error(
              `[RECONCILE] Erro ao reconciliar ${link.discordId}:`,
              error.message
            );
            addSyncLog({
              discordId: link.discordId,
              action: "RECONCILE_ERROR",
              reason: error.message,
              success: false
            });
            return false;
          }
        })
      );

      processed += batch.length;
      corrected += outcomes.filter(Boolean).length;

      // Respiro entre batches para não estourar rate limit da API do Discord.
      if (i + BATCH_SIZE < result.links.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    offset += result.links.length;
    page += 1;

    // Fim: alcançou o total informado, ou a página veio menor que o limite.
    if (total !== null && offset >= total) {
      break;
    }
    if (result.links.length < PAGE_SIZE) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const duration = Date.now() - startTime;

  if (processed === 0) {
    console.log("[RECONCILE] Nenhum vínculo retornado pelo backend.");
    return;
  }

  console.log(
    `[RECONCILE] Concluída em ${duration}ms. ${processed} processados, ${corrected} correções` +
    (membrosNaoEncontrados > 0
      ? `, ${membrosNaoEncontrados} membro(s) NAO ENCONTRADO(S) — cargo nao verificado. ` +
        `Se for a maioria, e' o intent GUILD_MEMBERS ausente (PRIVILEGED_INTENTS=${process.env.PRIVILEGED_INTENTS ?? "false"}).`
      : ".")
  );

  await notifyReconcileComplete(client, {
    processed,
    corrected,
    duration
  });
}

async function notifyReconcileComplete(
  client: Client,
  stats: {
    processed: number;
    corrected: number;
    duration: number;
  }
): Promise<void> {
  try {
    const logChannelId = process.env.DISCORD_SYNC_LOG_CHANNEL_ID;

    if (!logChannelId) {
      return;
    }

    const channel = await client.channels.fetch(logChannelId).catch(() => null);

    if (!channel || !(channel instanceof TextChannel)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🔄 Reconciliação Concluída")
      .setFields(
        {
          name: "Vínculos Processados",
          value: stats.processed.toString(),
          inline: true
        },
        {
          name: "Correções Aplicadas",
          value: stats.corrected.toString(),
          inline: true
        },
        {
          name: "Tempo Total",
          value: `${(stats.duration / 1000).toFixed(2)}s`,
          inline: true
        }
      )
      .setFooter({
        text: "TL Optimizer • Reconciliação Automática"
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error: any) {
    console.error("[RECONCILE] Erro ao notificar conclusão:", error.message);
  }
}

async function notifyReconcileError(
  client: Client,
  error: Error
): Promise<void> {
  try {
    const logChannelId = process.env.DISCORD_SYNC_LOG_CHANNEL_ID;

    if (!logChannelId) {
      return;
    }

    const channel = await client.channels.fetch(logChannelId).catch(() => null);

    if (!channel || !(channel instanceof TextChannel)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Erro na Reconciliação")
      .setDescription(error.message)
      .setFooter({
        text: "TL Optimizer • Reconciliação Automática"
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err: any) {
    console.error("[RECONCILE] Erro ao notificar erro:", err.message);
  }
}
