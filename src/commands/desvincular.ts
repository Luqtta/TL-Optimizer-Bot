import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

export const desvincularCommand = {
  data: new SlashCommandBuilder()
    .setName("desvincular")
    .setDescription(
      "Desvincule sua conta LS Optimizer."
    )
    .setDMPermission(true),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    const shouldBeEphemeral = Boolean(interaction.guildId);

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
          "Nao foi possivel desvincular."
        );
      }

      /*
       * remove cargos de plano no(s) servidor(es)
       */
      const planRoleIds = [
        process.env.ROLE_MONTHLY_ID,
        process.env.ROLE_YEARLY_ID,
        process.env.ROLE_LIFETIME_ID
      ].filter(Boolean) as string[];

      if (planRoleIds.length > 0) {
        const guildsToCheck = interaction.guild
          ? [interaction.guild]
          : Array.from(
            interaction.client.guilds.cache.values()
          );

        for (const guild of guildsToCheck) {
          const member = await guild.members
            .fetch(interaction.user.id)
            .catch(() => null);

          if (!member) {
            continue;
          }

          await member.roles.remove(planRoleIds);
        }
      }

      await interaction.reply({
        content:
          "Sua conta foi desvinculada com sucesso.",
        flags: shouldBeEphemeral ? 64 : undefined
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
        flags: shouldBeEphemeral ? 64 : undefined
      });
    }
  }
};
