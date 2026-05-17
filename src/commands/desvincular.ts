import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

export const desvincularCommand = {
  data: new SlashCommandBuilder()
    .setName("desvincular")
    .setDescription(
      "Desvincule sua conta LS Optimizer."
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    try {
      const response = await fetch(
        `${process.env.LS_API_URL}/discord/link/unlink`,
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
       * remove cargos
       */

      const guild =
        interaction.client.guilds.cache.first();

      if (guild) {
        const member = await guild.members
          .fetch(interaction.user.id)
          .catch(() => null);

        if (member) {
          const roles = [
            process.env.ROLE_MONTHLY_ID,
            process.env.ROLE_YEARLY_ID,
            process.env.ROLE_LIFETIME_ID
          ].filter(Boolean) as string[];

          await member.roles.remove(roles);
        }
      }

      await interaction.reply({
        content:
          "Sua conta foi desvinculada com sucesso.",
        ephemeral: true
      });

    } catch (error: any) {
      console.error(
        "[DESVINCULAR] erro:",
        error
      );

      await interaction.reply({
        content:
          error?.message ||
          "Erro ao desvincular conta.",
        ephemeral: true
      });
    }
  }
};