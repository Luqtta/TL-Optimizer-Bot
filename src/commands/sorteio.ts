import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

import { addGiveaway, getGiveaway } from "../services/database.service.js";
import {
  scheduleGiveaway,
  endGiveaway,
  GIVEAWAY_EMOJI
} from "../services/giveaway.service.js";

async function handleCriar(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("canal", true);
  const prize = interaction.options.getString("premio", true);
  const durationHours = interaction.options.getInteger("duracao", true);
  const winnersCount = interaction.options.getInteger("ganhadores") ?? 1;
  const minParticipants =
    interaction.options.getInteger("minimo_participantes") ?? 1;

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "❌ Selecione um canal de texto válido.",
      flags: 64
    });
    return;
  }

  const endAt = Date.now() + durationHours * 60 * 60 * 1000;
  const endUnix = Math.floor(endAt / 1000);

  const embed = new EmbedBuilder()
    .setColor("#3b82f6")
    .setTitle("🎉 SORTEIO")
    .setDescription(
      [
        `**Prêmio:** ${prize}`,
        "",
        `**Encerra:** <t:${endUnix}:F> (<t:${endUnix}:R>)`,
        `**Ganhadores:** ${winnersCount}`,
        `**Mínimo de participantes:** ${minParticipants}`,
        "",
        `Reaja com ${GIVEAWAY_EMOJI} para participar!`
      ].join("\n")
    )
    .setFooter({ text: "Reaja com 🎉 para participar" })
    .setTimestamp(endAt);

  const message = await (channel as TextChannel).send({
    content: "@everyone",
    embeds: [embed],
    allowedMentions: { parse: ["everyone"] }
  });

  await message.react(GIVEAWAY_EMOJI);

  const saved = addGiveaway({
    messageId: message.id,
    channelId: channel.id,
    guildId: interaction.guildId!,
    prize,
    winnersCount,
    minParticipants,
    endAt,
    hostId: interaction.user.id,
    status: "ACTIVE"
  });

  if (!saved) {
    await interaction.reply({
      content:
        "⚠️ O sorteio foi postado, mas não consegui salvá-lo. Ele pode não encerrar automaticamente.",
      flags: 64
    });
    return;
  }

  scheduleGiveaway(interaction.client, {
    messageId: message.id,
    channelId: channel.id,
    guildId: interaction.guildId!,
    prize,
    winnersCount,
    minParticipants,
    endAt,
    hostId: interaction.user.id,
    status: "ACTIVE"
  });

  await interaction.reply({
    content: `✅ Sorteio criado em ${channel}. Encerra <t:${endUnix}:R>.`,
    flags: 64
  });
}

async function handleEncerrar(interaction: ChatInputCommandInteraction) {
  const messageId = interaction.options.getString("id", true);
  const giveaway = getGiveaway(messageId);

  if (!giveaway) {
    await interaction.reply({
      content: "❌ Nenhum sorteio encontrado com esse ID de mensagem.",
      flags: 64
    });
    return;
  }

  if (giveaway.status !== "ACTIVE") {
    await interaction.reply({
      content: "❌ Esse sorteio já foi encerrado ou cancelado.",
      flags: 64
    });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  await endGiveaway(interaction.client, messageId);

  await interaction.editReply({
    content: "✅ Sorteio encerrado manualmente."
  });
}

export const sorteioCommand = {
  data: new SlashCommandBuilder()
    .setName("sorteio")
    .setDescription("Cria e gerencia sorteios.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("criar")
        .setDescription("Cria um novo sorteio em um canal.")
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("Canal onde o sorteio será postado.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("premio")
            .setDescription("Descrição do prêmio (ex: 1x Key Mensal TL Optimizer).")
            .setRequired(true)
            .setMaxLength(200)
        )
        .addIntegerOption((option) =>
          option
            .setName("duracao")
            .setDescription("Tempo em horas até o sorteio encerrar.")
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption((option) =>
          option
            .setName("ganhadores")
            .setDescription("Quantidade de ganhadores (padrão: 1).")
            .setRequired(false)
            .setMinValue(1)
        )
        .addIntegerOption((option) =>
          option
            .setName("minimo_participantes")
            .setDescription("Mínimo de participantes para validar (padrão: 1).")
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("encerrar")
        .setDescription("Encerra manualmente um sorteio antes do tempo.")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID da mensagem do sorteio.")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Esse comando só pode ser usado dentro de um servidor.",
        flags: 64
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Você não tem permissão para usar esse comando.",
        flags: 64
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "criar") {
      await handleCriar(interaction);
      return;
    }

    if (subcommand === "encerrar") {
      await handleEncerrar(interaction);
    }
  }
};
