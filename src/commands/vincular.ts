import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import { requestDiscordLink } from "../services/tlApi.service.js";

export const vincularCommand = {
  data: new SlashCommandBuilder()
    .setName("vincular")
    .setDescription("Vincule sua conta TL Optimizer.")
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
       * responde imediatamente
       * evita Unknown interaction
       */
      await interaction.deferReply({
        flags: shouldBeEphemeral ? 64 : undefined
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
       * envia DM com as instruções; se a DM estiver fechada,
       * as instruções vão na própria resposta (efêmera)
       */
      let dmSent = true;
      try {
        await interaction.user.send({
          content:
            `Código enviado para ${email}.\n\nDigite no privado do bot:\n/codigo CODIGO`
        });
      } catch {
        dmSent = false;
      }

      await interaction.editReply({
        content: dmSent
          ? "Verificação enviada para sua DM."
          : `Código enviado para ${email}.\nSua DM está fechada — use \`/codigo CODIGO\` no privado do bot para confirmar.`
      });

    } catch (error: any) {
      console.error(error);

      const errorMessage =
        error?.message ||
        "Não foi possível iniciar a vinculação.\nVerifique se sua DM está aberta.";

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: errorMessage
          });
        } else {
          await interaction.reply({
            content: errorMessage,
            flags: shouldBeEphemeral ? 64 : undefined
          });
        }
      } catch (replyError) {
        console.error(
          "[VINCULAR] Falha ao responder interaction:",
          replyError
        );
      }
    }
  }
};

