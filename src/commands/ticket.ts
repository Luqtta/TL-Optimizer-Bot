import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Configura o painel de suporte.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Envia o painel de tickets em um canal.")
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("Canal onde o painel será enviado.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({
      flags: 64
    });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "Você não tem permissão para configurar o sistema de tickets."
      });

      return;
    }

    const channel = interaction.options.getChannel("canal", true);

    if (channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: "Selecione um canal de texto válido."
      });

      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#3b82f6")
      .setTitle("Suporte TL Optimizer")
      .setDescription(
        [
          "Precisa de ajuda com o TL Optimizer?",
          "",
          "Abra um ticket para falar diretamente com a equipe.",
          "",
          "**Use tickets para:**",
          "• dúvidas sobre planos",
          "• problemas com login",
          "• erros no aplicativo",
          "• suporte técnico",
          "• dúvidas gerais sobre o produto",
          "",
          "Clique no botão abaixo para abrir seu atendimento."
        ].join("\n")
      )
      .setImage(
        "https://media.discordapp.net/attachments/1506355546142539796/1522622754598293804/TL_Suporte_Banner.png?ex=6a492471&is=6a47d2f1&hm=fc4ca950a8115bfb14985d21c920ae93c45d8888b1e8d40f05d951ab8e8deae4&=&format=webp&quality=lossless"
      )
      .setFooter({
        text: "TL Optimizer • Sistema de suporte"
      })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("Abrir Ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary)
    );

    await (channel as TextChannel).send({
      embeds: [embed],
      components: [row]
    });

    await interaction.editReply({
      content: `Painel de tickets enviado em ${channel}.`
    });
  }
};