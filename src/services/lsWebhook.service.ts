import type { Express } from "express";
import crypto from "crypto";

import {
  Client,
  EmbedBuilder,
  TextChannel
} from "discord.js";

import {
  addLinkedUser,
  getLinkedUserByEmail,
  updateLinkedUser,
  removeLinkedUser,
  addWebhookEvent,
  markWebhookEventAsProcessed,
  getPendingWebhookEvents,
  addSyncLog
} from "./database.service.js";

import { syncUserRolesInAllGuilds } from "./sync.service.js";
import { sendSyncNotification } from "./dm.service.js";

import type { WebhookEvent, LinkedUser } from "../types/index.js";

// Set para deduplicação de eventos (últimas 1000)
const recentEvents = new Set<string>();

export function registerLsOptimizerWebhookRoutes(app: Express, client: Client) {
  app.post("/webhooks/ls-optimizer", async (req: any, res) => {
    try {
      // Validação HMAC timing-safe
      const signature = req.headers["x-ls-signature"];
      const timestamp = req.headers["x-ls-timestamp"];
      const secret = process.env.LS_WEBHOOK_SECRET;

      if (!signature || !timestamp || !secret) {
        await logWebhookAction(client, {
          event: "WEBHOOK_INVALID",
          reason: "Missing signature, timestamp, or secret",
          success: false,
          statusCode: 401
        });
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validar timestamp (máximo 5 minutos)
      const webhookTimestamp = parseInt(timestamp);
      const currentTimestamp = Date.now() / 1000;

      if (Math.abs(currentTimestamp - webhookTimestamp) > 300) {
        await logWebhookAction(client, {
          event: "WEBHOOK_INVALID",
          reason: "Timestamp fora do intervalo válido",
          success: false,
          statusCode: 401
        });
        return res.status(401).json({ error: "Timestamp expired" });
      }

      // Validação HMAC timing-safe
      const payload = `${timestamp}:${req.rawBody.toString()}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      if (!timingSafeEqual(signature, expectedSignature)) {
        await logWebhookAction(client, {
          event: "WEBHOOK_INVALID",
          reason: "Assinatura HMAC inválida",
          success: false,
          statusCode: 401
        });
        return res.status(401).json({ error: "Invalid signature" });
      }

      const data = req.body;

      // Validação básica do payload
      if (!data.event || !data.discordId || !data.email) {
        await logWebhookAction(client, {
          event: "WEBHOOK_INVALID",
          reason: "Payload incompleto",
          success: false,
          statusCode: 400
        });
        return res.status(400).json({ error: "Invalid payload" });
      }

      // Deduplicação de eventos
      const eventId = `${data.event}:${data.discordId}:${data.email}:${timestamp}`;

      if (recentEvents.has(eventId)) {
        console.log("[WEBHOOK] Evento duplicado detectado e ignorado:", eventId);
        return res.status(200).json({ success: true, duplicate: true });
      }

      recentEvents.add(eventId);

      // Manter apenas últimas 1000 entradas
      if (recentEvents.size > 1000) {
        const firstEvent = Array.from(recentEvents)[0];
        recentEvents.delete(firstEvent);
      }

      // Processar webhook
      const webhookEvent: WebhookEvent = {
        type: data.event,
        discordId: data.discordId,
        email: data.email,
        previousPlan: data.previousPlan,
        newPlan: data.newPlan,
        timestamp: webhookTimestamp * 1000
      };

      await handleWebhookEvent(client, webhookEvent);

      await logWebhookAction(client, {
        event: webhookEvent.type,
        discordId: webhookEvent.discordId,
        success: true,
        statusCode: 200
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[WEBHOOK] Erro ao processar webhook:", error.message);

      await logWebhookAction(client, {
        event: "WEBHOOK_ERROR",
        reason: error.message,
        success: false,
        statusCode: 500
      });

      return res.status(500).json({ error: "Internal server error" });
    }
  });

}

// Apenas despacha o evento para o handler correto. NÃO grava na tabela
// (quem grava é handleWebhookEvent); assim pode ser reusado no reprocessamento.
async function dispatchWebhookEvent(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  switch (event.type) {
    case "LINKED":
      await handleLinked(client, event);
      break;

    case "UNLINKED":
      await handleUnlinked(client, event);
      break;

    case "UPGRADED":
      await handleUpgraded(client, event);
      break;

    case "DOWNGRADED":
      await handleDowngraded(client, event);
      break;

    case "RENEWED":
      await handleRenewed(client, event);
      break;

    case "CANCELED":
      await handleCanceled(client, event);
      break;

    case "REACTIVATED":
      await handleReactivated(client, event);
      break;

    case "EXPIRED":
      await handleExpired(client, event);
      break;

    case "REFUNDED":
      await handleRefunded(client, event);
      break;

    default:
      console.warn("[WEBHOOK] Evento desconhecido:", event.type);
  }
}

async function handleWebhookEvent(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const eventId = addWebhookEvent({
    eventType: event.type,
    discordId: event.discordId,
    email: event.email,
    previousPlan: event.previousPlan,
    newPlan: event.newPlan
  });

  try {
    await dispatchWebhookEvent(client, event);
    markWebhookEventAsProcessed(eventId);
  } catch (error: any) {
    console.error(
      `[WEBHOOK] Erro ao processar evento ${event.type}:`,
      error.message
    );

    // Evento permanece com processed=0 e será reprocessado no próximo boot.
    addSyncLog({
      discordId: event.discordId,
      action: `WEBHOOK_ERROR_${event.type}`,
      reason: error.message,
      success: false
    });
  }
}

// Reprocessa eventos que ficaram pendentes (processed=0) por falha transitória
// — ex.: o bot caiu antes de terminar, ou a guild ainda não tinha o membro.
// Chamado uma vez quando o client fica pronto. Limita a 24h para não ficar
// retentando eventos permanentemente quebrados para sempre.
export async function reprocessPendingWebhookEvents(
  client: Client
): Promise<void> {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const pending = getPendingWebhookEvents(since, 50);

  if (pending.length === 0) {
    return;
  }

  console.log(
    `[WEBHOOK] Reprocessando ${pending.length} evento(s) pendente(s)...`
  );

  let recovered = 0;

  for (const row of pending) {
    // Eventos sem dados essenciais não têm como ser reprocessados.
    if (!row.discordId || !row.email) {
      markWebhookEventAsProcessed(row.id);
      continue;
    }

    const event: WebhookEvent = {
      type: row.eventType as WebhookEvent["type"],
      discordId: row.discordId,
      email: row.email,
      previousPlan: row.previousPlan ?? undefined,
      newPlan: row.newPlan ?? undefined,
      timestamp: row.timestamp
    };

    try {
      await dispatchWebhookEvent(client, event);
      markWebhookEventAsProcessed(row.id);
      recovered++;
    } catch (error: any) {
      console.error(
        `[WEBHOOK] Falha ao reprocessar evento ${row.id} (${row.eventType}):`,
        error.message
      );

      addSyncLog({
        discordId: row.discordId,
        action: `WEBHOOK_RETRY_FAILED_${row.eventType}`,
        reason: error.message,
        success: false
      });
    }
  }

  console.log(
    `[WEBHOOK] Reprocessamento concluído: ${recovered}/${pending.length} recuperado(s).`
  );
}

async function handleLinked(client: Client, event: WebhookEvent): Promise<void> {
  const newUser: LinkedUser = {
    discordId: event.discordId,
    email: event.email,
    plan: (event.newPlan || "FREE") as "MONTHLY" | "YEARLY" | "LIFETIME" | "FREE",
    status: "ACTIVE",
    updatedAt: event.timestamp
  };

  addLinkedUser(newUser);

  // Sincronizar roles
  await syncUserRolesInAllGuilds(
    client,
    event.discordId,
    event.newPlan || "FREE"
  );

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "LINKED");

  console.log(`[WEBHOOK] Usuário ${event.discordId} vinculado.`);
}

async function handleUnlinked(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  // Remover cargos
  await syncUserRolesInAllGuilds(client, event.discordId, "FREE");

  // Remover do banco de dados
  removeLinkedUser(event.discordId);

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "UNLINKED");

  console.log(`[WEBHOOK] Usuário ${event.discordId} desvinculado.`);
}

async function handleUpgraded(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Sincronizar roles
  await syncUserRolesInAllGuilds(
    client,
    event.discordId,
    event.newPlan || "FREE",
    event.previousPlan
  );

  // Atualizar banco de dados
  updateLinkedUser(event.discordId, {
    plan: (event.newPlan || "FREE") as "MONTHLY" | "YEARLY" | "LIFETIME" | "FREE",
    status: "ACTIVE"
  });

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "UPGRADED", {
    previousPlan: (event.previousPlan || "FREE") as string,
    newPlan: (event.newPlan || "FREE") as string
  });

  console.log(
    `[WEBHOOK] Usuário ${event.discordId} fez upgrade para ${event.newPlan}.`
  );
}

async function handleDowngraded(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Sincronizar roles
  await syncUserRolesInAllGuilds(
    client,
    event.discordId,
    event.newPlan || "FREE",
    event.previousPlan
  );

  // Atualizar banco de dados
  updateLinkedUser(event.discordId, {
    plan: (event.newPlan || "FREE") as "MONTHLY" | "YEARLY" | "LIFETIME" | "FREE",
    status: "ACTIVE"
  });

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "DOWNGRADED", {
    previousPlan: (event.previousPlan || "FREE") as string,
    newPlan: (event.newPlan || "FREE") as string
  });

  console.log(
    `[WEBHOOK] Usuário ${event.discordId} fez downgrade para ${event.newPlan}.`
  );
}

async function handleRenewed(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Sincronizar roles
  await syncUserRolesInAllGuilds(
    client,
    event.discordId,
    (event.newPlan || user.plan) as "MONTHLY" | "YEARLY" | "LIFETIME" | "FREE"
  );

  // Atualizar banco de dados
  updateLinkedUser(event.discordId, {
    status: "ACTIVE"
  });

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "RENEWED", {
    plan: (event.newPlan || user.plan) as string
  });

  console.log(`[WEBHOOK] Assinatura de ${event.discordId} renovada.`);
}

async function handleCanceled(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Atualizar banco de dados
  updateLinkedUser(event.discordId, {
    status: "CANCELED"
  });

  // Enviar DM (não remove cargo, apenas avisa)
  await sendSyncNotification(client, event.discordId, "CANCELED");

  console.log(`[WEBHOOK] Assinatura de ${event.discordId} cancelada.`);
}

async function handleReactivated(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Sincronizar roles
  await syncUserRolesInAllGuilds(
    client,
    event.discordId,
    (event.newPlan || user.plan) as "MONTHLY" | "YEARLY" | "LIFETIME" | "FREE"
  );

  // Atualizar banco de dados
  updateLinkedUser(event.discordId, {
    status: "ACTIVE"
  });

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "REACTIVATED", {
    plan: (event.newPlan || user.plan) as string
  });

  console.log(`[WEBHOOK] Assinatura de ${event.discordId} reativada.`);
}

async function handleExpired(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Remover cargos
  await syncUserRolesInAllGuilds(client, event.discordId, "FREE");

  // Atualizar banco de dados
  updateLinkedUser(event.discordId, {
    plan: "FREE",
    status: "EXPIRED"
  });

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "EXPIRED");

  console.log(`[WEBHOOK] Assinatura de ${event.discordId} expirou.`);
}

async function handleRefunded(
  client: Client,
  event: WebhookEvent
): Promise<void> {
  const user = getLinkedUserByEmail(event.email);

  if (!user) {
    throw new Error(`Usuário não encontrado: ${event.email}`);
  }

  // Remover cargos
  await syncUserRolesInAllGuilds(client, event.discordId, "FREE");

  // Remover do banco de dados
  removeLinkedUser(event.discordId);

  // Enviar DM
  await sendSyncNotification(client, event.discordId, "REFUNDED");

  console.log(`[WEBHOOK] Reembolso processado para ${event.discordId}.`);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

async function logWebhookAction(
  client: Client,
  details: {
    event: string;
    discordId?: string;
    reason?: string;
    success: boolean;
    statusCode: number;
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

    const color = details.success ? 0x00ff00 : 0xff0000;
    const status = details.success ? "✅" : "❌";

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${status} ${details.event}`)
      .setFields(
        {
          name: "Status",
          value: details.success ? "Sucesso" : "Falha",
          inline: true
        },
        {
          name: "HTTP",
          value: `${details.statusCode}`,
          inline: true
        }
      )
      .setFooter({
        text: "LS Optimizer • Webhook"
      })
      .setTimestamp();

    if (details.reason) {
      embed.setDescription(details.reason);
    }

    if (details.discordId) {
      embed.addFields({
        name: "Discord ID",
        value: details.discordId,
        inline: true
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (error: any) {
    console.error("[WEBHOOK] Erro ao enviar log:", error.message);
  }
}
