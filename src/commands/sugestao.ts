import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel
} from "discord.js";

const CHANNEL_ID = "1505272626128355520";

export const sugestaoCommand = {
  data: new SlashCommandBuilder()
    .setName("sugestao")
    .setDescription("Envie uma sugestão para o LS Optimizer.")
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("Sua sugestão")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const mensagem = interaction.options.getString("mensagem", true);

    const channel = interaction.guild?.channels.cache.get(CHANNEL_ID);

    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "Canal de sugestões não encontrado.",
        ephemeral: true
      });

      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#ff2d2d")
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle("Nova sugestão")
      .setDescription(mensagem)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({
        text: `ID do usuário: ${interaction.user.id}`
      })
      .setTimestamp();

    const suggestionMessage = await channel.send({
      embeds: [embed]
    });

    await suggestionMessage.react("✅");
    await suggestionMessage.react("❌");

    await interaction.reply({
      content: "Sua sugestão foi enviada com sucesso.",
      ephemeral: true
    });
  }
};