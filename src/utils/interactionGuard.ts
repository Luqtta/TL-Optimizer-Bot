import { PermissionFlagsBits } from "discord.js";

// Comandos administrativos: só no servidor oficial e com Administrator NA HORA. O setDefaultMemberPermissions é só a
// visibilidade padrão (o dono do servidor pode liberar o comando pra outros cargos) e não protege nada num servidor
// alheio. /keymensal fica fora: vale no DM e confere o cargo de key ou o Administrator no servidor oficial.
export const ADMIN_COMMANDS = new Set([
  "sync", "userstatus", "stats", "qa", "sorteio", "regras", "ticket",
  "setup-antivirus", "setup-apresentacao", "setup-booster", "setup-download", "setup-verificar"
]);

// Formato mínimo de uma interação do discord.js (o check usa objetos falsos).
export interface GuardedInteraction {
  guildId: string | null;
  isChatInputCommand(): boolean;
  commandName?: string;
  memberPermissions?: { has(permission: bigint): boolean } | null;
}

// Barreira de TODA interação (comando, botão, modal). De outro servidor (bot convidado por alguém): ignora em silêncio;
// sem GUILD_ID configurado também (fecha em vez de abrir). DM passa (/vincular, /codigo, /keymensal...), menos comando
// administrativo, que exige o servidor oficial.
export function guardInteraction(interaction: GuardedInteraction): "ok" | "ignore" | "forbidden" {
  const official = process.env.GUILD_ID;
  if (interaction.guildId && interaction.guildId !== official) return "ignore";
  if (interaction.isChatInputCommand() && ADMIN_COMMANDS.has(interaction.commandName ?? "")) {
    if (!interaction.guildId) return "forbidden";
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return "forbidden";
  }
  return "ok";
}
