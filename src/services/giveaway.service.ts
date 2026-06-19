import {
  Client,
  EmbedBuilder,
  TextChannel,
  ChannelType,
  type Message,
  type User
} from "discord.js";

import {
  getActiveGiveaways,
  getGiveaway,
  updateGiveawayStatus
} from "./database.service.js";
import type { Giveaway } from "../types/index.js";

export const GIVEAWAY_EMOJI = "🎉";

// setTimeout estoura em delays acima de ~24,8 dias (2^31-1 ms) e dispara
// imediatamente. Para sorteios longos, reagendamos em blocos.
const MAX_TIMEOUT_DELAY = 2_147_483_647;

// Timers ativos por messageId, para conseguir cancelar no encerramento manual.
const timers = new Map<string, NodeJS.Timeout>();

function clearGiveawayTimer(messageId: string): void {
  const timer = timers.get(messageId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(messageId);
  }
}

/**
 * Agenda o encerramento automático de um sorteio. Rearma em blocos quando o
 * tempo restante excede o limite do setTimeout.
 */
export function scheduleGiveaway(client: Client, giveaway: Giveaway): void {
  clearGiveawayTimer(giveaway.messageId);

  const delay = giveaway.endAt - Date.now();

  if (delay <= 0) {
    void endGiveaway(client, giveaway.messageId);
    return;
  }

  if (delay > MAX_TIMEOUT_DELAY) {
    const timer = setTimeout(() => {
      scheduleGiveaway(client, giveaway);
    }, MAX_TIMEOUT_DELAY);
    timers.set(giveaway.messageId, timer);
    return;
  }

  const timer = setTimeout(() => {
    void endGiveaway(client, giveaway.messageId);
  }, delay);
  timers.set(giveaway.messageId, timer);
}

/**
 * Reagenda todos os sorteios ativos após um restart. Sorteios cujo prazo já
 * passou enquanto o bot estava offline são encerrados imediatamente.
 */
export function startGiveawayScheduler(client: Client): void {
  const active = getActiveGiveaways();

  for (const giveaway of active) {
    scheduleGiveaway(client, giveaway);
  }

  console.log(`[SORTEIO] ${active.length} sorteio(s) ativo(s) reagendado(s).`);
}

async function fetchParticipants(message: Message): Promise<User[]> {
  const reaction = message.reactions.cache.find(
    (r) => r.emoji.name === GIVEAWAY_EMOJI
  );

  if (!reaction) {
    return [];
  }

  const participants: User[] = [];
  let after: string | undefined;

  // A API pagina em lotes de até 100; percorremos tudo para não perder ninguém.
  while (true) {
    const batch = await reaction.users.fetch({ limit: 100, after });

    if (batch.size === 0) {
      break;
    }

    for (const user of batch.values()) {
      if (!user.bot) {
        participants.push(user);
      }
    }

    after = batch.last()?.id;

    if (batch.size < 100) {
      break;
    }
  }

  return participants;
}

function pickWinners(participants: User[], count: number): User[] {
  // Fisher-Yates: embaralha uma cópia e fatia os N primeiros.
  const pool = [...participants];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * Encerra um sorteio: apura os participantes, valida o mínimo, sorteia os
 * ganhadores e anuncia o resultado. Idempotente — só age em sorteios ACTIVE.
 */
export async function endGiveaway(
  client: Client,
  messageId: string
): Promise<void> {
  clearGiveawayTimer(messageId);

  const giveaway = getGiveaway(messageId);

  if (!giveaway || giveaway.status !== "ACTIVE") {
    return;
  }

  try {
    const channel = await client.channels.fetch(giveaway.channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error(
        `[SORTEIO] Canal ${giveaway.channelId} indisponível para o sorteio ${messageId}.`
      );
      updateGiveawayStatus(messageId, "CANCELED");
      return;
    }

    const textChannel = channel as TextChannel;
    const message = await textChannel.messages.fetch(messageId).catch(() => null);

    if (!message) {
      console.error(
        `[SORTEIO] Mensagem ${messageId} não encontrada; cancelando sorteio.`
      );
      updateGiveawayStatus(messageId, "CANCELED");
      return;
    }

    const participants = await fetchParticipants(message);

    if (participants.length < giveaway.minParticipants) {
      const canceledEmbed = new EmbedBuilder()
        .setColor("#CC0000")
        .setTitle("🚫 SORTEIO CANCELADO")
        .setDescription(
          [
            `**Prêmio:** ${giveaway.prize}`,
            "",
            `O sorteio foi cancelado por falta de participantes.`,
            `Mínimo necessário: **${giveaway.minParticipants}** • Participantes: **${participants.length}**`
          ].join("\n")
        )
        .setTimestamp();

      await textChannel.send({
        content: "@everyone",
        embeds: [canceledEmbed],
        allowedMentions: { parse: ["everyone"] }
      });

      updateGiveawayStatus(messageId, "CANCELED");
      return;
    }

    const winners = pickWinners(participants, giveaway.winnersCount);
    const winnerMentions = winners.map((user) => `<@${user.id}>`);

    const resultEmbed = new EmbedBuilder()
      .setColor("#CC0000")
      .setTitle("🏆 SORTEIO ENCERRADO")
      .setDescription(
        [
          `**Prêmio:** ${giveaway.prize}`,
          "",
          winners.length === 1 ? "**Ganhador:**" : "**Ganhadores:**",
          winnerMentions.map((mention) => `• ${mention}`).join("\n"),
          "",
          `Parabéns! 🎉 Total de participantes: **${participants.length}**`
        ].join("\n")
      )
      .setFooter({ text: "LS Optimizer • Sorteios" })
      .setTimestamp();

    await textChannel.send({
      content: `@everyone Parabéns ${winnerMentions.join(" ")}!`,
      embeds: [resultEmbed],
      allowedMentions: { parse: ["everyone"], users: winners.map((u) => u.id) }
    });

    updateGiveawayStatus(messageId, "ENDED");
  } catch (error) {
    console.error(`[SORTEIO] Erro ao encerrar sorteio ${messageId}:`, error);
  }
}
