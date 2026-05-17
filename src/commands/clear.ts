import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

export const clearCommand = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Limpa mensagens de um canal.")
    .addIntegerOption((option) =>
      option
        .setName("quantidade")
        .setDescription("Quantidade de mensagens para apagar. Máximo: 100.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({
      ephemeral: true
    });

    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.editReply({
          content: "Você não tem permissão para limpar mensagens."
        });

        return;
      }

      if (!interaction.guild) {
        await interaction.editReply({
          content: "Esse comando só pode ser usado em servidor."
        });

        return;
      }

      const amount = interaction.options.getInteger("quantidade", true);
      const channel = interaction.channel;

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({
          content: "Esse comando só pode ser usado em canais de texto."
        });

        return;
      }

      const deleted = await (channel as TextChannel).bulkDelete(amount, true);

      await interaction.editReply({
        content: `Foram apagadas ${deleted.size} mensagens.`
      });
    } catch (error) {
      console.error("[DISCORD] Erro no comando /clear:", error);

      await interaction.editReply({
        content:
          "Ocorreu um erro ao limpar as mensagens. Verifique se tenho permissão de Gerenciar Mensagens."
      });
    }
  }
};