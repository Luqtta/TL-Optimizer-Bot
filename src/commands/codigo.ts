import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import { confirmDiscordCode } from "../services/tlApi.service.js";
import { addLinkedUser } from "../services/database.service.js";
import { syncUserRolesInAllGuilds } from "../services/sync.service.js";

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

      const isDM = interaction.channel?.isDMBased();

      if (!isDM) {
        console.log("[CODIGO] ❌ Não é DM!");
        await interaction.reply({
          content:
            "Use esse comando apenas na DM do bot.",
          flags: 64
        });

        return;
      }

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
       * Sincronizar cargos em todos os servidores
       */
      await syncUserRolesInAllGuilds(
        interaction.client,
        interaction.user.id,
        data.plan
      );

      /*
       * Salvar no banco de dados
       */
      addLinkedUser({
        discordId: interaction.user.id,
        email: data.email,
        plan: data.plan,
        status: "ACTIVE",
        updatedAt: Date.now()
      });

      /*
       * NÃO mandar o DM "Conta Vinculada" aqui: o confirmDiscordCode acima dispara o webhook LINKED
       * no backend, e o handleLinked (tlWebhook.service) já envia esse DM. Mandar aqui duplicava.
       */

      await interaction.reply({
        content:
          `Conta vinculada com sucesso.\nPlano detectado: ${data.plan}`,
        flags: 64
      });

    } catch (error: any) {
      console.error("[CODIGO] erro:", error);

      await interaction.reply({
        content:
          error?.message ||
          "Código inválido ou expirado.",
        flags: 64
      });
    }
  }
};