import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import { confirmDiscordCode } from "../services/lsApi.service.js";
import { syncPlanRoles } from "../services/planRole.service.js";

export const codigoCommand = {
  data: new SlashCommandBuilder()
    .setName("codigo")
    .setDescription("Confirme seu código.")
    .addStringOption(option =>
      option
        .setName("codigo")
        .setDescription("Código recebido")
        .setRequired(true)
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    try {
      console.log("[CODIGO] comando recebido");
      console.log("[CODIGO] TEST 1");

      const isDM = interaction.channel?.isDMBased();
      console.log("[CODIGO] isDM:", isDM);

      if (!isDM) {
        console.log("[CODIGO] ❌ Não é DM!");
        await interaction.reply({
          content:
            "Use esse comando apenas na DM do bot.",
          ephemeral: true
        });

        return;
      }

      console.log("[CODIGO] ✅ É DM!");

      const code = interaction.options.getString(
        "codigo",
        true
      );

      console.log("[CODIGO] validando código...");

      const data = await confirmDiscordCode(
        interaction.user.id,
        code
      );

      console.log("[CODIGO] resposta API:", data);

      /*
       * pega membro do servidor
       */
      const guild = interaction.client.guilds.cache.first();

      if (!guild) {
        throw new Error(
          "Servidor não encontrado."
        );
      }

      const member = await guild.members.fetch(
        interaction.user.id
      );

      await syncPlanRoles(
        member,
        data.plan
      );

      await interaction.reply({
        content:
          `Conta vinculada com sucesso.\nPlano detectado: ${data.plan}`,
        ephemeral: true
      });

    } catch (error: any) {
      console.error("[CODIGO] erro:", error);

      await interaction.reply({
        content:
          error?.message ||
          "Código inválido ou expirado.",
        ephemeral: true
      });
    }
  }
};