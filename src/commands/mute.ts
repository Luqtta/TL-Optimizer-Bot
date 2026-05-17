import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember
} from "discord.js";

function parseDurationToMs(duration: string): number | null {
  const match = duration.match(/^(\d+)(s|m|h|d)$/i);

  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit as keyof typeof multipliers];
}

export const muteCommand = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Aplica timeout em um usuário.")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuário que será mutado.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("tempo")
        .setDescription("Duração do mute. Ex: 10m, 1h, 1d")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Motivo do mute.")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.editReply({
          content: "Você não tem permissão para mutar membros."
        });

        return;
      }

      const user = interaction.options.getUser("usuario", true);
      const duration = interaction.options.getString("tempo", true);
      const reason =
        interaction.options.getString("motivo") ?? "Nenhum motivo informado.";

      const ms = parseDurationToMs(duration);

      if (!ms) {
        await interaction.editReply({
          content: "Tempo inválido. Use formatos como: `10m`, `1h`, `1d`."
        });

        return;
      }

      const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;

      if (ms > maxTimeoutMs) {
        await interaction.editReply({
          content: "O tempo máximo de timeout no Discord é 28 dias."
        });

        return;
      }

      const member = await interaction.guild?.members
        .fetch(user.id)
        .catch(() => null);

      if (!member) {
        await interaction.editReply({
          content: "Não consegui encontrar esse usuário no servidor."
        });

        return;
      }

      if (!(member instanceof GuildMember)) {
        await interaction.editReply({
          content: "Não consegui validar esse membro."
        });

        return;
      }

      if (member.id === interaction.user.id) {
        await interaction.editReply({
          content: "Você não pode mutar você mesmo."
        });

        return;
      }

      if (member.user.bot) {
        await interaction.editReply({
          content: "Não é recomendado mutar bots por esse comando."
        });

        return;
      }

      if (!member.moderatable) {
        await interaction.editReply({
          content:
            "Não consigo mutar esse usuário. Verifique se meu cargo está acima do cargo dele e se tenho permissão de Moderar Membros."
        });

        return;
      }

      await member.timeout(
        ms,
        `${reason} | Moderador: ${interaction.user.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor("#ff2d2d")
        .setTitle("Usuário mutado")
        .setDescription(`${user} recebeu timeout.`)
        .addFields(
          {
            name: "Usuário",
            value: `${user}`,
            inline: true
          },
          {
            name: "Tempo",
            value: duration,
            inline: true
          },
          {
            name: "Motivo",
            value: reason,
            inline: false
          },
          {
            name: "Moderador",
            value: `${interaction.user}`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });
    } catch (error) {
      console.error("[DISCORD] Erro no comando /mute:", error);

      await interaction.editReply({
        content:
          "Ocorreu um erro ao tentar mutar esse usuário. Verifique minhas permissões e a hierarquia dos cargos."
      });
    }
  }
};