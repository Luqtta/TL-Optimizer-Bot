import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from "discord.js";

import { generateMonthlyKey } from "../services/tlApi.service.js";

// [MOD] Gera 1 key do plano MENSAL pra entregar num ticket de boost. Feito pra rodar no DM do bot,
// mas funciona em qualquer canal (a resposta é sempre privada). Como no DM NÃO existe contexto de
// servidor, o gate de cargo é feito buscando o membro no GUILD_ID (fetch via REST, funciona sem o
// intent GUILD_MEMBERS). setDefaultMemberPermissions NÃO vale em DM, por isso a checagem é no código.
// Plano, quantidade e o limite de 10/dia por mod são TRAVADOS no backend.
export const keyMensalCommand = {
  data: new SlashCommandBuilder()
    .setName("keymensal")
    .setDescription("[MOD] Gera uma key do plano Mensal pra entregar num ticket de boost.")
    .setDMPermission(true),

  async execute(interaction: ChatInputCommandInteraction) {
    // Ephemeral só em servidor; no DM já é privado (ephemeral no DM dá erro).
    await interaction.deferReply({ ephemeral: !!interaction.guild });

    // Gate de cargo: busca o membro no servidor (funciona no DM também).
    const guildId = process.env.GUILD_ID;
    const guild =
      (guildId ? interaction.client.guilds.cache.get(guildId) : undefined) ??
      interaction.client.guilds.cache.first();

    if (!guild) {
      await interaction.editReply("❌ Não consegui verificar suas permissões (servidor não encontrado).");
      return;
    }

    let allowed = false;
    try {
      const member = await guild.members.fetch(interaction.user.id);
      const roleId = process.env.KEY_GEN_ROLE_ID;
      const hasRole = !!roleId && member.roles.cache.has(roleId);
      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
      allowed = hasRole || isAdmin;
    } catch {
      allowed = false; // não está no servidor / não deu pra buscar
    }

    if (!allowed) {
      await interaction.editReply("❌ Você não tem permissão para gerar keys.");
      return;
    }

    try {
      const { code } = await generateMonthlyKey(interaction.user.id);
      await interaction.editReply(
        `🔑 **Key do plano Mensal gerada:**\n\`\`\`${code}\`\`\`\n` +
        "Entregue no ticket. É de uso único e ativa o plano quando o cliente resgatar no app."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar a key.";
      await interaction.editReply(`❌ ${msg}`);
    }
  }
};
