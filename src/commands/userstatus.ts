import {
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";

import {
  getLinkedUser,
  getSyncLogs
} from "../services/database.service.js";
import { EmbedBuilder } from "discord.js";

export const userStatusCommand = {
  data: new SlashCommandBuilder()
    .setName("userstatus")
    .setDescription("Verificar status de um usuário vinculado")
    .setDMPermission(true)
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Usuário para verificar")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const targetUser = interaction.options.getUser("user") || interaction.user;
      const linked = getLinkedUser(targetUser.id);

      if (!linked) {
        return await interaction.editReply({
          content: `${targetUser.tag} não está vinculado.`
        });
      }

      const logs = getSyncLogs(targetUser.id, 10);
      const statusColor = linked.status === "ACTIVE" ? 0x00ff00 : 0xff0000;

      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`👤 Status de ${targetUser.tag}`)
        .addFields(
          {
            name: "Email",
            value: linked.email,
            inline: false
          },
          {
            name: "Plano",
            value: linked.plan,
            inline: true
          },
          {
            name: "Status",
            value: linked.status,
            inline: true
          },
          {
            name: "Atualizado em",
            value: `<t:${Math.floor(linked.updatedAt / 1000)}:R>`,
            inline: true
          }
        )
        .setFooter({
          text: "LS Optimizer • Status do Usuário"
        })
        .setTimestamp();

      if (logs.length > 0) {
        const recentLogs = logs
          .slice(0, 3)
          .map(
            log =>
              `• ${log.action} - ${log.success ? "✅" : "❌"}`
          )
          .join("\n");

        embed.addFields({
          name: "Ações Recentes",
          value: recentLogs,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error("[USERSTATUS] erro:", error);
      await interaction.editReply({
        content: `Erro ao buscar status: ${error.message}`
      });
    }
  }
};
