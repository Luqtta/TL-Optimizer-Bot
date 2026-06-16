import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { commands as botCommands } from "./commands/index.js";

dotenv.config();

const commands = botCommands.map((command) => command.data.toJSON());

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
