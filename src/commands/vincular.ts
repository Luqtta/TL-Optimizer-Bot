import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import { requestDiscordLink } from "../services/lsApi.service.js";

export const vincularCommand = {
  data: new SlashCommandBuilder()
    .setName("vincular")
    .setDescription("Vincule sua conta LS Optimizer.")
    .addStringOption(option =>
      option
        .setName("email")
        .setDescription("Seu email da conta")
        .setRequired(true)
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    const email = interaction.options.getString(
      "email",
      true
    );

    try {
      /*
       * testa se DM está aberta
       */
      await interaction.user.send({
        content:
          "Verificando conexão de DM..."
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
          `Código enviado para ${email}.\n\nDigite no privado do bot:\n/codigo CODIGO`
      });

      await interaction.reply({
        content:
          "Verificação enviada para sua DM.",
        ephemeral: true
      });

    } catch (error: any) {
      console.error(error);

      await interaction.reply({
        content:
          error?.message ||
          "Não foi possível iniciar a vinculação.\nVerifique se sua DM está aberta.",
        ephemeral: true
      });
    }
  }
};