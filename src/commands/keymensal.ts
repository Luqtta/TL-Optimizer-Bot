import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from "discord.js";

import { generateMonthlyKey } from "../services/tlApi.service.js";

// Mensagem-padrão de entrega da key (o mod copia e cola no ticket de boost). `mention` = <@id> do
// booster quando informado, senão o placeholder "@usuario" pra editar na mão.
// ponytail: mesmo template duplicado no painel web (tl-optimizer-web frontend Admin.tsx, buildKeyMessage,
// header neutro por lá); mexeu no passo a passo aqui, mexe lá.
function deliveryMessage(code: string, mention: string): string {
  return [
    `## 🎉 Obrigado pelo boost, ${mention}`,
    "",
    "Sua key de ativação já está disponível abaixo:",
    "",
    `> 🔑 Key: ${code}`,
    "",
    "**Como ativar**",
    "",
    "1. Acesse o site: https://tloptimizer.com/dashboard",
    "2. Faça login (ou crie uma conta, caso não tenha)",
    "3. Vá até o painel de usuário, clicando no seu perfil",
    "4. No campo \"ativar sua key\", cole a key acima e resgate",
    "5. Abra o programa e entre na sua conta — a licença já estará ativa ✅",
    "6. Vincule sua conta em cargo-assinante com o email que ativou a key para ter seu cargo exclusivo"
  ].join("\n");
}

// [EQUIPE] Gera 1 key do plano MENSAL e devolve a mensagem-padrão pronta pra colar no ticket de boost.
// Roda no DM do bot (resposta privada). Gate = qualquer cargo em KEY_GEN_ROLE_ID (lista separada por
// vírgula, ex.: auxiliares + mods) OU admin do Discord, checado buscando o membro no GUILD_ID (funciona
// no DM, via REST). Plano/quantidade/limite (10/dia por gerador) são travados no backend, e TODA key é
// rastreável (fica registrado quem gerou e quem usou).
export const keyMensalCommand = {
  data: new SlashCommandBuilder()
    .setName("keymensal")
    .setDescription("[EQUIPE] Gera uma key Mensal + mensagem pronta pra entregar no ticket de boost.")
    .setDMPermission(true)
    .addUserOption((o) =>
      o.setName("usuario")
        .setDescription("Quem recebeu o boost (mencionado na mensagem). Opcional.")
        .setRequired(false)
    ),

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
      const roleIds = (process.env.KEY_GEN_ROLE_ID || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
      const hasRole = roleIds.some((id) => member.roles.cache.has(id));
      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
      allowed = hasRole || isAdmin;
    } catch {
      allowed = false; // não está no servidor / não deu pra buscar
    }

    if (!allowed) {
      await interaction.editReply("❌ Você não tem permissão para gerar keys.");
      return;
    }

    let code: string;
    try {
      const result = await generateMonthlyKey(interaction.user.id);
      code = result.code;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar a key.";
      await interaction.editReply(`❌ ${msg}`);
      return;
    }

    const target = interaction.options.getUser("usuario");
    const mention = target ? `<@${target.id}>` : "@usuario";

    await interaction.editReply(
      "✅ Key gerada. **Uso exclusivo pra entrega de boost** — e ela é **rastreável** " +
      "(fica registrado que você gerou e quem resgatar). Copie a mensagem abaixo e cole no ticket:\n\n" +
      "```\n" + deliveryMessage(code, mention) + "\n```"
    );
  }
};
