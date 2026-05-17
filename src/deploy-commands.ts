import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { pingCommand } from "./commands/ping.js";
import { regrasCommand } from "./commands/regras.js";
import { muteCommand } from "./commands/mute.js";
import { unmuteCommand } from "./commands/unmute.js";
import { clearCommand } from "./commands/clear.js";
import { ticketCommand } from "./commands/ticket.js";
import { sugestaoCommand } from "./commands/sugestao.js";
import { vincularCommand } from "./commands/vincular.js";
import { desvincularCommand } from "./commands/desvincular.js";
import { codigoCommand } from "./commands/codigo.js";
import { qaCommand } from "./commands/qa.js";

dotenv.config();

const commands = [
  pingCommand.data.toJSON(),
  regrasCommand.data.toJSON(),
  muteCommand.data.toJSON(),
  unmuteCommand.data.toJSON(),
  clearCommand.data.toJSON(),
  ticketCommand.data.toJSON(),
  sugestaoCommand.data.toJSON(),
  vincularCommand.data.toJSON(),
  desvincularCommand.data.toJSON(),
  codigoCommand.data.toJSON(),
  qaCommand.data.toJSON()
];
const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN!
);

async function deployCommands() {
  try {
    console.log("[DISCORD] Registrando slash commands globais...");

    const clientId = process.env.CLIENT_ID!;
    const guildId = process.env.GUILD_ID;
    const isGuildOnly = process.env.GUILD_ONLY === "true";

    let route;
    if (isGuildOnly && guildId) {
      console.log(`[DISCORD] Modo: Guild-only (servidor: ${guildId})`);
      route = Routes.applicationGuildCommands(clientId, guildId);
    } else {
      console.log("[DISCORD] Modo: Comandos globais (funcionam em DM, servidores, etc)");
      route = Routes.applicationCommands(clientId);
    }

    await rest.put(route, { body: commands });

    console.log("[DISCORD] ✓ Slash commands registrados com sucesso!");
    console.log("[DISCORD] Nota: Comandos globais podem levar até 1 hora para sincronizar em todos os servidores.");
  } catch (error) {
    console.error("[DISCORD] Erro ao registrar comandos:", error);
    process.exit(1);
  }
}

deployCommands();
