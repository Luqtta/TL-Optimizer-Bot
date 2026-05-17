import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember
} from "discord.js";

export const unmuteCommand = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove o timeout de um usuário.")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuário que terá o timeout removido.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Motivo do unmute.")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.editReply({
          content: "Você não tem permissão para desmutar membros."
        });

        return;
      }

      const user = interaction.options.getUser("usuario", true);
      const reason =
        interaction.options.getString("motivo") ?? "Nenhum motivo informado.";

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

      if (!member.moderatable) {
        await interaction.editReply({
          content:
            "Não consigo desmutar esse usuário. Verifique minha permissão e hierarquia de cargos."
        });

        return;
      }

      await member.timeout(
        null,
        `${reason} | Moderador: ${interaction.user.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor("#22c55e")
        .setTitle("Usuário desmutado")
        .setDescription(`${user} teve o timeout removido.`)
        .addFields(
          {
            name: "Usuário",
            value: `${user}`,
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
      console.error("[DISCORD] Erro no comando /unmute:", error);

      await interaction.editReply({
        content:
          "Ocorreu um erro ao tentar remover o timeout desse usuário. Verifique minhas permissões."
      });
    }
  }
};