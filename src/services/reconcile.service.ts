import {
  Client,
  EmbedBuilder,
  TextChannel
} from "discord.js";

import { getAllLinkedUsers, updateLinkedUser, addSyncLog } from "./database.service.js";
import { syncUserRolesInAllGuilds } from "./sync.service.js";

import type { LinkedUser } from "../types/index.js";

const BATCH_SIZE = 5;
const RECONCILE_INTERVAL = 30 * 60 * 1000; // 30 minutes

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

async function runReconciliation(client: Client): Promise<void> {
  console.log("[RECONCILE] Iniciando reconciliação...");
  const startTime = Date.now();

  const linkedUsers = getAllLinkedUsers();

  if (linkedUsers.length === 0) {
    console.log("[RECONCILE] Nenhum usuário vinculado encontrado.");
    return;
  }

  console.log(`[RECONCILE] Reconciliando ${linkedUsers.length} usuários...`);

  let processed = 0;
  let corrected = 0;

  for (let i = 0; i < linkedUsers.length; i += BATCH_SIZE) {
    const batch = linkedUsers.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (user) => {
        try {
          const result = await reconcileUser(client, user);

          if (result.corrected) {
            corrected++;
          }

          processed++;
        } catch (error: any) {
          console.error(
            `[RECONCILE] Erro ao reconciliar ${user.discordId}:`,
            error.message
          );
          addSyncLog({
            discordId: user.discordId,
            action: "RECONCILE_ERROR",
            reason: error.message,
            success: false
          });
        }
      })
    );

    // Pequeno delay entre batches para não sobrecarregar
    if (i + BATCH_SIZE < linkedUsers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const duration = Date.now() - startTime;

  console.log(
    `[RECONCILE] Reconciliação concluída em ${duration}ms. ${processed} usuários processados, ${corrected} correções aplicadas.`
  );

  await notifyReconcileComplete(client, {
    processed,
    corrected,
    duration
  });
}

async function reconcileUser(
  client: Client,
  user: LinkedUser
): Promise<{ corrected: boolean }> {
  try {
    const backendUser = await fetchUserFromBackend(user.email);

    if (!backendUser) {
      throw new Error(`Usuário não encontrado no backend: ${user.email}`);
    }

    let corrected = false;

    // Se o plano mudou, sincronizar roles
    if (user.plan !== backendUser.plan) {
      console.log(
        `[RECONCILE] Ajustando plano de ${user.discordId}: ${user.plan} → ${backendUser.plan}`
      );

      const results = await syncUserRolesInAllGuilds(
        client,
        user.discordId,
        backendUser.plan,
        user.plan
      );

      if (results.some((r) => r.result.success)) {
        updateLinkedUser(user.discordId, {
          plan: backendUser.plan,
          status: backendUser.status
        });

        addSyncLog({
          discordId: user.discordId,
          action: "RECONCILE_PLAN_UPDATED",
          reason: `Plano atualizado de ${user.plan} para ${backendUser.plan}`,
          success: true
        });

        corrected = true;
      }
    }

    // Se o status mudou e o usuário expirou, remover cargos
    if (user.status !== backendUser.status && backendUser.status === "EXPIRED") {
      console.log(
        `[RECONCILE] Usuário ${user.discordId} expirou, removendo cargos...`
      );

      const results = await syncUserRolesInAllGuilds(
        client,
        user.discordId,
        "FREE"
      );

      if (results.some((r) => r.result.success)) {
        updateLinkedUser(user.discordId, {
          status: "EXPIRED"
        });

        addSyncLog({
          discordId: user.discordId,
          action: "RECONCILE_EXPIRED",
          reason: "Assinatura expirada, cargos removidos",
          success: true
        });

        corrected = true;
      }
    }

    return { corrected };
  } catch (error: any) {
    throw error;
  }
}

async function fetchUserFromBackend(email: string): Promise<any> {
  try {
    const response = await fetch(
      `${process.env.LS_API_URL}/discord/link/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-Api-Key": process.env.DISCORD_BOT_API_KEY || ""
        },
        body: JSON.stringify({ email })
      }
    );

    if (!response.ok) {
      throw new Error(`Backend retornou ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error(
      "[RECONCILE] Erro ao buscar dados do backend:",
      error.message
    );
    throw error;
  }
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
          name: "Usuários Processados",
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
        text: "LS Optimizer • Reconciliação Automática"
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
        text: "LS Optimizer • Reconciliação Automática"
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err: any) {
    console.error("[RECONCILE] Erro ao notificar erro:", err.message);
  }
}
