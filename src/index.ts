import {
  ActivityType,
  Client,
  GatewayIntentBits,
  Options
} from "discord.js";

import type {
  Interaction
} from "discord.js";

import dotenv from "dotenv";
import express from "express";

import { commandMap } from "./commands/index.js";

import {
  handleTicketButton,
  handleTicketModal
} from "./interactions/ticketButtons.js";

import { registerGithubWebhookRoutes } from "./services/githubWebhookServer.js";
import {
  registerLsOptimizerWebhookRoutes,
  reprocessPendingWebhookEvents
} from "./services/lsWebhook.service.js";
import { initializeDatabase, closeDatabase } from "./services/database.service.js";
import { startReconcileScheduler, stopReconcileScheduler } from "./services/reconcile.service.js";
import { startGiveawayScheduler } from "./services/giveaway.service.js";
import { messageCreateEvent } from "./events/messageCreate.js";
import { guildMemberAddEvent } from "./events/guildMemberAdd.js";
import { guildMemberUpdateEvent } from "./events/guildMemberUpdate.js";
import { validateEnv } from "./utils/validateEnv.js";

dotenv.config();
validateEnv();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  // Limita a cache de mensagens — maior fonte de crescimento de memória com a
  // intent MessageContent. O bot age na mensagem no próprio evento e busca
  // transcrições de ticket via API, então não depende de cache longa.
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 50
  }),
  // Além do sweeper padrão (threads), varre mensagens antigas periodicamente.
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 3600,
      lifetime: 1800
    }
  }
});

client.once("clientReady", () => {
  console.log(`[DISCORD] Bot online como ${client.user?.tag}`);

  // Inicializar banco de dados
  initializeDatabase();

  // Reagendar sorteios ativos que sobreviveram a um restart
  startGiveawayScheduler(client);

  // Inicializar servidor de webhooks unificado
  const app = express();

  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  // Healthcheck para monitores de uptime / plataformas de hosting.
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      discord: client.isReady() ? "ready" : "not-ready",
      wsPing: client.ws.ping
    });
  });

  registerLsOptimizerWebhookRoutes(app, client);
  registerGithubWebhookRoutes(app, client);

  const webhookPort = Number(process.env.PORT) || 3001;

  app.listen(webhookPort, "0.0.0.0", () => {
    console.log(`[WEBHOOK] Servidor unificado rodando em 0.0.0.0:${webhookPort}`);
  });

  // Reprocessar eventos de webhook que ficaram pendentes (ex.: queda do bot).
  reprocessPendingWebhookEvents(client).catch((error) => {
    console.error("[WEBHOOK] Erro ao reprocessar eventos pendentes:", error);
  });

  // Inicializar scheduler de reconciliação
  startReconcileScheduler(client);

  const activities = [
    {
      name: "TL Optimizer",
      type: ActivityType.Playing
    },
    {
      name: "TL Optimizer",
      type: ActivityType.Listening
    },
    {
      name: "Luqtta desenvolver",
      type: ActivityType.Watching
    },
    {
      name: "tickets de suporte",
      type: ActivityType.Watching
    },
    {
      name: "baixa latência",
      type: ActivityType.Playing
    }
  ];

  let index = 0;

  client.user?.setPresence({
    activities: [activities[index]!],
    status: "online"
  });

  setInterval(() => {
    index = (index + 1) % activities.length;

    client.user?.setPresence({
      activities: [activities[index]!],
      status: "online"
    });
  }, 30_000);
});

client.on("interactionCreate", async (interaction: Interaction) => {
  try {
    if (interaction.isButton()) {
      await handleTicketButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleTicketModal(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);

    if (command) {
      await command.execute(interaction);
    }

  } catch (error) {
    console.error("[DISCORD] Erro no interactionCreate:", error);

    try {
      if (
        interaction.isRepliable()
      ) {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.editReply({
            content:
              "Ocorreu um erro ao executar essa interação."
          }).catch(() => {});
        } else {
          await interaction.reply({
            content:
              "Ocorreu um erro ao executar essa interação.",
            flags: 64
          }).catch(() => {});
        }
      }
    } catch (replyError) {
      console.error(
        "[DISCORD] Falha ao responder erro:",
        replyError
      );
    }
  }
});

client.on("guildMemberAdd", async (member) => {
  await guildMemberAddEvent(member);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  await guildMemberUpdateEvent(oldMember, newMember);
});

client.on("messageCreate", async (message) => {
  await messageCreateEvent(message);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[BOT] Encerrando bot (${signal})...`);
  stopReconcileScheduler();
  await client.destroy();
  closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

client.login(process.env.DISCORD_TOKEN);

