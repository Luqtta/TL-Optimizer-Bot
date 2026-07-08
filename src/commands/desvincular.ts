import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import { removeLinkedUser } from "../services/database.service.js";
import { syncUserRolesInAllGuilds } from "../services/sync.service.js";

export const desvincularCommand = {
  data: new SlashCommandBuilder()
    .setName("desvincular")
    .setDescription(
      "Desvincule sua conta TL Optimizer."
    )
    .setDMPermission(true),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    const shouldBeEphemeral = Boolean(interaction.guildId);

    try {
      // Backend + sync de cargos pode passar de 3s; defer evita "Unknown interaction".
      await interaction.deferReply({
        flags: shouldBeEphemeral ? 64 : undefined
      });

      const response = await fetch(
        `${process.env.TL_API_URL}/discord/link/unlink`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bot-Api-Key":
              process.env.DISCORD_BOT_API_KEY || ""
          },
          body: JSON.stringify({
            discordId: interaction.user.id
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Não foi possível desvincular."
        );
      }

      /*
       * remove cargos de plano em todos os servidores
       */
      await syncUserRolesInAllGuilds(
        interaction.client,
        interaction.user.id,
        "FREE"
      );

      /*
       * remove do banco de dados
       */
      removeLinkedUser(interaction.user.id);

      await interaction.editReply({
        content:
          "Sua conta foi desvinculada com sucesso."
      });

    } catch (error: any) {
      console.error(
        "[DESVINCULAR] erro:",
        error
      );

      const content =
        error?.message || "Erro ao desvincular conta.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({
          content,
          flags: shouldBeEphemeral ? 64 : undefined
        });
      }
    }
  }
};
