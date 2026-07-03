import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

import { getAllLinkedUsers, getSyncLogs } from "../services/database.service.js";
import { EmbedBuilder } from "discord.js";

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Ver estatísticas de sincronização")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const linkedUsers = getAllLinkedUsers();
      const activeUsers = linkedUsers.filter(u => u.status === "ACTIVE").length;
      const expiredUsers = linkedUsers.filter(u => u.status === "EXPIRED").length;
      const canceledUsers = linkedUsers.filter(u => u.status === "CANCELED").length;

      const monthlyUsers = linkedUsers.filter(u => u.plan === "MONTHLY").length;
      const yearlyUsers = linkedUsers.filter(u => u.plan === "YEARLY").length;
      const lifetimeUsers = linkedUsers.filter(u => u.plan === "LIFETIME").length;

      const syncLogs = getSyncLogs(undefined, 100);
      const successLogs = syncLogs.filter(log => log.success === 1).length;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📊 Estatísticas de Sincronização")
        .addFields(
          {
            name: "Usuários Vinculados",
            value: linkedUsers.length.toString(),
            inline: true
          },
          {
            name: "Usuários Ativos",
            value: activeUsers.toString(),
            inline: true
          },
          {
            name: "Usuários Expirados",
            value: expiredUsers.toString(),
            inline: true
          },
          {
            name: "Usuários Cancelados",
            value: canceledUsers.toString(),
            inline: true
          },
          {
            name: "Plano: Monthly",
            value: monthlyUsers.toString(),
            inline: true
          },
          {
            name: "Plano: Yearly",
            value: yearlyUsers.toString(),
            inline: true
          },
          {
            name: "Plano: Lifetime",
            value: lifetimeUsers.toString(),
            inline: true
          },
          {
            name: "Sincronizações bem-sucedidas (últimas 100)",
            value: successLogs.toString(),
            inline: true
          }
        )
        .setFooter({
          text: "TL Optimizer • Estatísticas"
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error("[STATS] erro:", error);
      await interaction.editReply({
        content: "Erro ao buscar estatísticas."
      });
    }
  }
};
