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

function createVerifyEmbed() {
  return new EmbedBuilder()
    .setColor("#3b82f6")
    .setTitle("Vincule sua conta TL Optimizer")
    .setDescription(
      [
        "Vincule o e-mail da sua conta do site para receber automaticamente os cargos das suas compras: o do seu plano e o do TL Playbook.",
        "",
        "Clique em **Vincular conta**, informe o e-mail e confirme com o código que enviamos.",
        "",
        "Ainda não tem conta? Crie em https://tloptimizer.com"
      ].join("\n")
    );
}

export const setupVerificarCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-verificar")
    .setDescription("Envia o painel de vínculo de conta (cargos de plano e TL Playbook) neste canal.")
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
        .setCustomId("verify_start")
        .setLabel("Vincular conta")
        .setStyle(ButtonStyle.Primary)
    );

    await (channel as TextChannel).send({
      embeds: [createVerifyEmbed()],
      components: [row]
    });

    await interaction.reply({
      content: "✅ Painel de vínculo enviado com sucesso.",
      flags: 64
    });
  }
};
