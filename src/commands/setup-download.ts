import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

// A página "Como usar" do site já tem o botão de download — um link só cobre os dois.
const HOW_TO_USE_URL = "https://thelite.com.br/como-usar";

function createDownloadEmbed() {
  return new EmbedBuilder()
    .setColor("#3b82f6")
    .setTitle("⬇️ Baixe o TL Optimizer")
    .setDescription(
      [
        "Baixe o **TL Optimizer** e comece a otimizar seu PC para games — grátis, leve, sem vírus e sem telemetria invasiva.",
        "",
        "Na mesma página você encontra o **passo a passo de como usar**: baixar, criar a conta, otimizar e configurar o Game Mode.",
        "",
        "Clique no botão abaixo para baixar e aprender a usar. 🚀"
      ].join("\n")
    );
}

export const setupDownloadCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-download")
    .setDescription("Envia o embed de download / como usar neste canal.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Você não tem permissão para usar esse comando.",
        flags: 64
      });

      return;
    }

    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "❌ Esse comando só pode ser usado em um canal de texto.",
        flags: 64
      });

      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Baixar & Como usar")
        .setStyle(ButtonStyle.Link)
        .setURL(HOW_TO_USE_URL)
    );

    await (channel as TextChannel).send({
      embeds: [createDownloadEmbed()],
      components: [row]
    });

    await interaction.reply({
      content: "✅ Mensagem de download enviada com sucesso.",
      flags: 64
    });
  }
};
