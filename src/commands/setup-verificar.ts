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
    .setTitle("🔒 Verifique sua assinatura")
    .setDescription(
      [
        "É assinante do **TL Optimizer**? Verifique com o email da sua compra para receber o **cargo de assinante** e destravar os canais VIP + benefícios exclusivos.",
        "",
        "Clique em **Verificar assinatura**, informe seu email e confirme com o código que enviamos — rápido e seguro.",
        "",
        "Ainda não é assinante? Crie sua conta e escolha um plano em https://thelite.com.br"
      ].join("\n")
    );
}

export const setupVerificarCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-verificar")
    .setDescription("Envia o painel de verificação de assinatura neste canal.")
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
        .setLabel("Verificar assinatura")
        .setStyle(ButtonStyle.Primary)
    );

    await (channel as TextChannel).send({
      embeds: [createVerifyEmbed()],
      components: [row]
    });

    await interaction.reply({
      content: "✅ Painel de verificação enviado com sucesso.",
      flags: 64
    });
  }
};
