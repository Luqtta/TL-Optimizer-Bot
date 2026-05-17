import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import { requestDiscordLink } from "../services/lsApi.service.js";

export const vincularCommand = {
  data: new SlashCommandBuilder()
    .setName("vincular")
    .setDescription("Vincule sua conta LS Optimizer.")
    .setDMPermission(true)
    .addStringOption(option =>
      option
        .setName("email")
        .setDescription("Seu email da conta")
        .setRequired(true)
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    const shouldBeEphemeral = Boolean(interaction.guildId);

    const email = interaction.options.getString(
      "email",
      true
    );

    try {
      /*
       * testa se DM esta aberta
       */
      await interaction.user.send({
        content:
          "Verificando conexao de DM..."
      });

      /*
       * chama API
       */
      await requestDiscordLink(
        email,
        interaction.user.id,
        interaction.user.username
      );

      /*
       * envia DM real
       */
      await interaction.user.send({
        content:
          `Codigo enviado para ${email}.\n\nDigite no privado do bot:\n/codigo CODIGO`
      });

      await interaction.reply({
        content:
          "Verificacao enviada para sua DM.",
        ephemeral: shouldBeEphemeral
      });

    } catch (error: any) {
      console.error(error);

      await interaction.reply({
        content:
          error?.message ||
          "Nao foi possivel iniciar a vinculacao.\nVerifique se sua DM esta aberta.",
        ephemeral: shouldBeEphemeral
      });
    }
  }
};
