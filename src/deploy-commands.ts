import { REST, Routes } from "discord.js";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { commands as botCommands } from "./commands/index.js";

dotenv.config();

// Registra os slash commands no Discord. Roda no boot do bot (usando as vars da Railway) e
// também dá pra chamar manualmente via `npm run deploy`. Idempotente — pode rodar todo boot.
export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  if (!token || !clientId) {
    console.warn("[DISCORD] DISCORD_TOKEN/CLIENT_ID ausentes — pulei o registro de comandos.");
    return;
  }

  const body = botCommands.map((command) => command.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(token);

  const guildId = process.env.GUILD_ID;
  const isGuildOnly = process.env.GUILD_ONLY === "true";

  let route;
  if (isGuildOnly && guildId) {
    console.log(`[DISCORD] Registrando ${body.length} comandos (guild ${guildId})...`);
    route = Routes.applicationGuildCommands(clientId, guildId);
  } else {
    console.log(`[DISCORD] Registrando ${body.length} comandos globais...`);
    route = Routes.applicationCommands(clientId);
  }

  await rest.put(route, { body });
  console.log("[DISCORD] ✓ Slash commands registrados.");
}

// Execução direta (`npm run deploy`): registra e sai. Ao ser importado (pelo index), não roda sozinho.
const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirect) {
  registerCommands().catch((error) => {
    console.error("[DISCORD] Erro ao registrar comandos:", error);
    process.exit(1);
  });
}
