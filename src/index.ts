import {
  ActivityType,
  Client,
  GatewayIntentBits
} from "discord.js";

import type {
  Interaction
} from "discord.js";

import dotenv from "dotenv";

import { pingCommand } from "./commands/ping.js";
import { muteCommand } from "./commands/mute.js";
import { unmuteCommand } from "./commands/unmute.js";
import { regrasCommand } from "./commands/regras.js";
import { clearCommand } from "./commands/clear.js";
import { ticketCommand } from "./commands/ticket.js";
import { sugestaoCommand } from "./commands/sugestao.js";
import { vincularCommand } from "./commands/vincular.js";
import { desvincularCommand } from "./commands/desvincular.js";
import { codigoCommand } from "./commands/codigo.js";
import { qaCommand } from "./commands/qa.js";


import {
  handleTicketButton,
  handleTicketModal
} from "./interactions/ticketButtons.js";


import { startGithubWebhookServer } from "./services/githubWebhookServer.js";
import { messageCreateEvent } from "./events/messageCreate.js";
import { guildMemberAddEvent } from "./events/guildMemberAdd.js";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("clientReady", () => {
  console.log(`[DISCORD] Bot online como ${client.user?.tag}`);

  const activities = [
    {
      name: "LS Optimizer",
      type: ActivityType.Playing
    },
    {
      name: "LS Optimizer",
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

  startGithubWebhookServer(client);
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

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
      await pingCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "regras") {
      await regrasCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "mute") {
      await muteCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "unmute") {
      await unmuteCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "clear") {
      await clearCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "sugestao") {
      await sugestaoCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "vincular") {
      await vincularCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "desvincular") {
      await desvincularCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "codigo") {
      await codigoCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "ticket") {
      await ticketCommand.execute(interaction);
      return;
    }

    if (interaction.commandName === "qa") {
      await qaCommand.execute(interaction);
      return;
    }
  } catch (error) {
    console.error("[DISCORD] Erro no interactionCreate:", error);

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: "Ocorreu um erro ao executar essa interação."
        });
      } else {
        await interaction.reply({
          content: "Ocorreu um erro ao executar essa interação.",
          ephemeral: true
        });
      }
    }
  }
});

client.on("guildMemberAdd", async (member) => {
  await guildMemberAddEvent(member);
});

client.on("messageCreate", async (message) => {
  await messageCreateEvent(message);
});

client.login(process.env.DISCORD_TOKEN);
