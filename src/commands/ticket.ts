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
      .setColor("#ff2d2d")
      .setTitle("Suporte LS Optimizer")
      .setDescription(
        [
          "Precisa de ajuda com o LS Optimizer?",
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
        "https://media.discordapp.net/attachments/1504995651308621941/1516952826037796977/LS_Optimizer_Suporte_Banner.png?ex=6a3483e9&is=6a333269&hm=f4f9c8793f38d356c3696b8f569a3159f0341730debd5103b35e388370cce1e9&=&format=webp&quality=lossless"
      )
      .setFooter({
        text: "LS Optimizer • Sistema de suporte"
      })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Danger)
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