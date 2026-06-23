import {
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";

function createQaEmbed() {
  return new EmbedBuilder()
    .setColor("#0f0f0f")
    .setTitle("🚀 LS Optimizer - Performance & Game Boost")
    .setDescription(
      [
        "LS Optimizer é um aplicativo focado em melhorar o desempenho do seu PC e a estabilidade dos jogos, aplicando otimizações automáticas de sistema e ajustes inteligentes de performance.",
        "",
        "⚡ Como funciona:",
        "",
        "• \"Analisa seu sistema automaticamente\"",
        "• \"Aplica otimizações seguras em tempo real\"",
        "• \"Ajusta recursos para priorizar jogos e apps pesados\"",
        "• \"Mantém estabilidade e reduz travamentos\"",
        "",
        "🎮 Ideal para:",
        "Jogadores que querem mais FPS, menos stutter e melhor resposta do sistema sem precisar mexer manualmente no Windows.",
        "",
        "🌐 Site https://ls-optimizer-web.vercel.app",
        "💰 Plano mensal em promoção: R$10 (antes R$15)",
        "",
        "🔄 Atualizações constantes e melhorias automáticas"
      ].join("\n")
    );
}

export const qaCommand = {
  data: new SlashCommandBuilder()
    .setName("qa")
    .setDescription("Envia a mensagem de apresentação do LS Optimizer.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("Canal onde a mensagem será enviada.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({
      flags: 64
    });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "Você não tem permissão para usar esse comando."
      });
      return;
    }

    if (!interaction.guild) {
      await interaction.editReply({
        content: "Esse comando só pode ser usado em servidores."
      });
      return;
    }

    const selectedChannel = interaction.options.getChannel("canal");
    const targetChannel = selectedChannel ?? interaction.channel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: "Selecione um canal de texto válido."
      });
      return;
    }

    const embed = createQaEmbed();
    const textChannel = targetChannel as TextChannel;

    let sentWithWebhook = false;

    try {
      const webhooks = await textChannel.fetchWebhooks();

      let webhook = webhooks.find(
        (item) => item.name === "LS Optimizer QA" && item.token
      );

      if (!webhook) {
        webhook = await textChannel.createWebhook({
          name: "LS Optimizer QA"
        });
      }

      await webhook.send({
        username: "LS Optimizer - Performance & Game Boost",
        embeds: [embed]
      });

      sentWithWebhook = true;
    } catch (error) {
      console.error("[DISCORD] Erro ao enviar /qa via webhook:", error);

      await textChannel.send({
        embeds: [embed]
      });
    }

    await interaction.editReply({
      content: sentWithWebhook
        ? `Mensagem enviada via webhook em ${targetChannel}.`
        : `Mensagem enviada em ${targetChannel} (fallback sem webhook).`
    });
  }
};
