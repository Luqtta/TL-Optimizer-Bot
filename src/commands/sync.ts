import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

import {
  getLinkedUser,
  updateLinkedUser
} from "../services/database.service.js";
import { syncUserRolesInAllGuilds } from "../services/sync.service.js";
import { EmbedBuilder } from "discord.js";

export const syncCommand = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Sincronizar um usuário manualmente")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Usuário a sincronizar")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("plano")
        .setDescription("Plano para atribuir")
        .setRequired(true)
        .addChoices(
          { name: "Monthly", value: "MONTHLY" },
          { name: "Yearly", value: "YEARLY" },
          { name: "Lifetime", value: "LIFETIME" },
          { name: "Free", value: "FREE" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const targetUser = interaction.options.getUser("user", true);
      const plan = interaction.options.getString("plano", true);

      const linked = getLinkedUser(targetUser.id);

      if (!linked) {
        return await interaction.editReply({
          content: `${targetUser.tag} não está vinculado.`
        });
      }

      const results = await syncUserRolesInAllGuilds(
        interaction.client,
        targetUser.id,
        plan,
        linked.plan
      );

      updateLinkedUser(targetUser.id, {
        plan: plan as any,
        status: "ACTIVE"
      });

      const successCount = results.filter(r => r.result.success).length;

      const embed = new EmbedBuilder()
        .setColor(successCount > 0 ? 0x00ff00 : 0xff0000)
        .setTitle("🔄 Sincronização Manual")
        .addFields(
          {
            name: "Usuário",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: false
          },
          {
            name: "Plano Anterior",
            value: linked.plan,
            inline: true
          },
          {
            name: "Novo Plano",
            value: plan,
            inline: true
          },
          {
            name: "Servidores Sincronizados",
            value: `${successCount}/${results.length}`,
            inline: true
          }
        )
        .setFooter({
          text: "TL Optimizer • Sincronização Manual"
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error("[SYNC] erro:", error);
      await interaction.editReply({
        content: `Erro ao sincronizar: ${error.message}`
      });
    }
  }
};
