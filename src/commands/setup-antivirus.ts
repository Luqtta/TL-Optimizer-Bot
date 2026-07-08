import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

function createAntivirusEmbed() {
  return new EmbedBuilder()
    .setColor("#3b82f6")
    .setTitle("Detecção falsa de vírus (falso positivo)")
    .setDescription(
      [
        "🛡️ **O TL Optimizer é 100% seguro**",
        "Sem vírus, sem malware e sem telemetria invasiva. Todas as otimizações são **reversíveis** e atuam **localmente** na sua máquina — não lemos seus arquivos nem o conteúdo do seu PC.",
        "",
        "🚫 **Por que o antivírus às vezes reclama**",
        "Mesmo software legítimo pode gerar falso positivo, principalmente ferramentas de otimização de PC. O TL faz ações que a heurística dos antivírus costuma marcar:",
        "• Altera configurações do Windows a nível de sistema",
        "• Interage com componentes protegidos do sistema operacional",
        "• Roda com privilégios de administrador (necessário pra otimizar)",
        "• Usa ofuscação para se proteger contra pirataria e adulteração",
        "",
        "Isso é comum no mundo da otimização — **não significa que há vírus**.",
        "",
        "🛠️ **O que fazer se for bloqueado**",
        "• Baixe **sempre pelo site oficial**: https://thelite.com.br",
        "• Adicione uma exceção para o TL Optimizer no seu antivírus",
        "• Se precisar, abra um ticket que a equipe te ajuda a liberar",
        "",
        "📊 **Transparência total**",
        "Tudo o que o app faz no seu computador está detalhado na nossa Política de Privacidade (seção “O que o app faz no seu computador”):",
        "https://thelite.com.br/privacidade"
      ].join("\n")
    )
    .setImage(
      "https://media.discordapp.net/attachments/1505279965321760930/1524503849602388178/image.png?ex=6a4ffc59&is=6a4eaad9&hm=561e780a9435b7a1911fc2815494a98a8a43654ebb756e45b254323b10dcfd54&=&format=webp&quality=lossless&width=1813&height=864"
    );
}

export const setupAntivirusCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-antivirus")
    .setDescription("Envia o embed sobre falso positivo de antivírus neste canal.")
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
      embeds: [createAntivirusEmbed()]
    });

    await interaction.reply({
      content: "✅ Mensagem sobre falso positivo enviada com sucesso.",
      flags: 64
    });
  }
};
