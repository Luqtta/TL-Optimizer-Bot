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
    .setColor("#3b82f6")
    .setDescription(
      [
        "Bem-vindo ao servidor oficial do **TL Optimizer**! <:ls:1517592999716982996>",
        "",
        "Aqui você encontra suporte, novidades, atualizações e uma comunidade focada em performance e otimização de PC para games.",
        "",
        "🚀 **Performance & Game Boost para Windows**",
        "O TL Optimizer é um app desktop focado em melhorar o desempenho do seu PC e a estabilidade nos jogos — de forma automática, simples e segura.",
        "",
        "⚡ **Como funciona:**",
        "• Analisa e otimiza seu sistema automaticamente",
        "• Aplica ajustes de rede e memória em tempo real",
        "• Prioriza recursos para jogos e apps pesados",
        "• Mantém estabilidade e reduz travamentos",
        "",
        "🎮 **Game Mode:**",
        "Configure uma vez e esqueça. O app detecta automaticamente quando você abre um jogo (Valorant, CS2, Fortnite, Apex, LoL e mais) e aplica o preset ideal — Balanceado, Competitivo, Extremo ou Streaming. Ao fechar o jogo, tudo volta ao estado anterior sozinho.",
        "",
        "🧹 **Limpeza automática:**",
        "Mesmo fora dos jogos, o app limpa arquivos temporários e libera memória em intervalos configuráveis — sem você precisar fazer nada.",
        "",
        "🆓 **Comece grátis — crie sua conta e use o app sem pagar nada!**",
        "",
        "💰 **Planos a partir de R$25/mês**",
        "",
        "**Leia as regras** antes de participar e aproveite tudo que o servidor tem a oferecer!",
        "",
        "Para suporte, abra um ticket no canal <#1504988115994153050> e nossa equipe te ajuda diretamente.",
        "",
        "**MAXIMIZE SEU PC** ⚡",
        "",
        "**Links Úteis**",
        "<:ls:1517592999716982996> [Site](https://thelite.com.br) • <:discord:1517592080308764754> [Discord](https://discord.gg/RMWFK5KgTz)",
        "",
        "**Redes Sociais**",
        "<:tiktok:1517592036549591236> [TikTok](https://www.tiktok.com/@lsoptimizer) • <:youtube:1517592095500533952> [YouTube](https://www.youtube.com/@LsOptimizerbr) • <:instagram:1517592064898896053> [Instagram](https://www.instagram.com/lsoptimizer/)"
      ].join("\n")
    )
    .setImage(
      "https://media.discordapp.net/attachments/1468487286365749281/1522626499944120330/TL_Optimizer_Banner.png?ex=6a4927ee&is=6a47d66e&hm=cf46a1db612b408a467982c13cbfc708cfcc9c88637ad05376892e96a5aa388d&=&format=webp&quality=lossless"
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
