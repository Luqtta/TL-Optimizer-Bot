import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

function createRulesEmbed() {
  return new EmbedBuilder()
    .setColor("#ff2d2d")
    .setTitle("📌 REGRAS DO SERVIDOR")
    .setDescription(
      [
        "Sigam as regras para manter um ambiente seguro, organizado e confortável para todos.",
        "Qualquer infração poderá resultar em punição ou banimento.",
        "**Não tente contornar as regras.**",
        "",
        "**1️⃣ Convivência**",
        "• Respeito acima de tudo.",
        "• Proibido preconceito, discurso de ódio, assédio ou ataques pessoais.",
        "• Ameaças e ofensas não serão toleradas.",
        "",
        "**2️⃣ Conteúdo Apropriado**",
        "• Proibido conteúdo sexual, explícito ou inadequado.",
        "• Sem piadas ou incentivo a suicídio ou automutilação.",
        "",
        "**3️⃣ Organização do Servidor**",
        "• Evite spam, flood, CAPS excessivo e poluição visual.",
        "• Em call, evite ruídos propositalmente.",
        "",
        "**4️⃣ Segurança e Privacidade**",
        "• Proibido links suspeitos, golpes, cheats ou vendas de contas.",
        "• Não compartilhe dados pessoais.",
        "",
        "**5️⃣ Comunidade e Moderação**",
        "• Respeite todos, incluindo a staff.",
        "• Não marque administradores sem necessidade.",
        "",
        "**6️⃣ Suporte**",
        "• Use tickets para suporte.",
        "• Não chame a staff no privado sem necessidade.",
        "• Confira FAQ e canais informativos antes de perguntar.",
        "",
        "**🚨 Denúncias**",
        "Se presenciar algo fora das regras, abra um ticket.",
        "A equipe tomará providências o mais rápido possível.",
        "",
        "**Servidor organizado = comunidade forte.**"
      ].join("\n")
    )
    .setFooter({
      text: "LS Optimizer • Regras oficiais do servidor"
    })
    .setTimestamp();
}

export const regrasCommand = {
  data: new SlashCommandBuilder()
    .setName("regras")
    .setDescription("Mostra ou envia as regras do servidor.")
    .addStringOption((option) =>
      option
        .setName("acao")
        .setDescription("Ação administrativa.")
        .addChoices({
          name: "set",
          value: "set"
        })
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("Canal para enviar as regras.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const action = interaction.options.getString("acao");
    const channel = interaction.options.getChannel("canal");
    const embed = createRulesEmbed();

    if (!action) {
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      return;
    }

    if (action === "set") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: "❌ Você não tem permissão para usar esse comando.",
          ephemeral: true
        });

        return;
      }

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: "❌ Selecione um canal de texto válido.",
          ephemeral: true
        });

        return;
      }

      await (channel as TextChannel).send({
        embeds: [embed]
      });

      await interaction.reply({
        content: `✅ Regras enviadas com sucesso em ${channel}.`,
        ephemeral: true
      });

      return;
    }

    await interaction.reply({
      content: "❌ Ação inválida.",
      ephemeral: true
    });
  }
};