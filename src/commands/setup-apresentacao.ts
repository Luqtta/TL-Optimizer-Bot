import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

function createApresentacaoEmbed() {
  return new EmbedBuilder()
    .setColor("#CC0000")
    .setDescription(
      [
        "Bem-vindo ao servidor oficial do **LS Optimizer**! <:ls:1517593146505297961>",
        "",
        "Aqui você encontra suporte, novidades, atualizações e uma comunidade focada em performance e otimização de PC para games.",
        "",
        "**Leia as regras** antes de participar e aproveite tudo que o servidor tem a oferecer!",
        "",
        "Para suporte, abra um ticket no canal <#1504988115994153050> e nossa equipe te ajuda diretamente.",
        "",
        "**MAXIMIZE SEU PC** ⚡",
        "",
        "**Links Úteis**",
        "<:ls:1517593146505297961> [Site](https://lsoptimizer.com) • <:discord:1517593115026788483> [Discord](https://discord.gg/J9y352CDbz)",
        "",
        "**Redes Sociais**",
        "<:tiktok:1517593155426582679> [TikTok](https://www.tiktok.com/@lsoptimizer) • <:youtube:1517593124619292802> [YouTube](https://www.youtube.com/@LsOptimizerbr) • <:instagram:1517593172048351233> [Instagram](https://www.instagram.com/lsoptimizer/)"
      ].join("\n")
    )
    .setImage(
      "https://media.discordapp.net/attachments/1508950013668098078/1517572511347376218/LS_Optimizer_Apresentacao_Banner.png?ex=6a36c509&is=6a357389&hm=b61e3c605451a8d2f7a3a4dcf5cb2d2c9284277f8f46ef2a2b7fcf8786d6edce&=&format=webp&quality=lossless"
    );
}

export const setupApresentacaoCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-apresentacao")
    .setDescription("Envia o embed de apresentação do servidor neste canal.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Você não tem permissão para usar esse comando.",
        flags: 64
      });

      return;
    }

    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "❌ Esse comando só pode ser usado em um canal de texto.",
        flags: 64
      });

      return;
    }

    await (channel as TextChannel).send({
      embeds: [createApresentacaoEmbed()]
    });

    await interaction.reply({
      content: "✅ Mensagem de apresentação enviada com sucesso.",
      flags: 64
    });
  }
};
