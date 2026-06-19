import type { ChatInputCommandInteraction } from "discord.js";

import { pingCommand } from "./ping.js";
import { regrasCommand } from "./regras.js";
import { muteCommand } from "./mute.js";
import { unmuteCommand } from "./unmute.js";
import { clearCommand } from "./clear.js";
import { ticketCommand } from "./ticket.js";
import { setupApresentacaoCommand } from "./setup-apresentacao.js";
import { sorteioCommand } from "./sorteio.js";
import { sugestaoCommand } from "./sugestao.js";
import { vincularCommand } from "./vincular.js";
import { desvincularCommand } from "./desvincular.js";
import { codigoCommand } from "./codigo.js";
import { qaCommand } from "./qa.js";
import { statsCommand } from "./stats.js";
import { syncCommand } from "./sync.js";
import { userStatusCommand } from "./userstatus.js";

export interface BotCommand {
  data: { name: string; toJSON: () => unknown };
  execute: (
    interaction: ChatInputCommandInteraction
  ) => Promise<unknown> | unknown;
}

// Registro central de todos os slash commands. index.ts (roteamento) e
// deploy-commands.ts (registro na API) consomem a MESMA lista — adicionar um
// comando novo é só incluir aqui.
export const commands: BotCommand[] = [
  pingCommand,
  regrasCommand,
  muteCommand,
  unmuteCommand,
  clearCommand,
  ticketCommand,
  setupApresentacaoCommand,
  sorteioCommand,
  sugestaoCommand,
  vincularCommand,
  desvincularCommand,
  codigoCommand,
  qaCommand,
  statsCommand,
  syncCommand,
  userStatusCommand
];

export const commandMap = new Map<string, BotCommand>(
  commands.map((command) => [command.data.name, command])
);
