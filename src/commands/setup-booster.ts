import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from "discord.js";

function createBoosterEmbed() {
  return new EmbedBuilder()
    .setColor("#f47fff") // rosa de boost do Discord
    .setTitle("🚀 Dê 2 boosts e ganhe 1 mês de TL Optimizer grátis")
    .setDescription(
      [
        "Impulsione o servidor do **TL Optimizer** com **2 boosts** e ganhe **1 mês do plano Mensal totalmente grátis** — nossa forma de agradecer quem ajuda a comunidade a crescer. 💜",
        "",
        "🎁 **O que você ganha:**",
        "• 1 mês do plano **Mensal** liberado no app, de graça",
        "• Cargo de assinante + acesso aos canais e benefícios VIP",
        "",
        "✅ **Como resgatar:**",
        "1. Dê **2 boosts** no servidor (o Nitro te dá 2 — é só aplicar os dois aqui)",
        "2. Vincule sua conta com `/vincular` (o mesmo email da sua conta TL Optimizer)",
        "3. Abra um ticket avisando — a equipe confirma seus boosts e credita o seu mês",
        "",
        "Ainda não tem conta? Crie de graça em https://thelite.com.br",
        "",
        "**Obrigado por impulsionar o servidor!** 🚀"
      ].join("\n")
    );
}

export const setupBoosterCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-booster")
    .setDescription("Envia o embed de apresentação da recompensa de boost neste canal.")
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
      embeds: [createBoosterEmbed()]
    });

    await interaction.reply({
      content: "✅ Mensagem de recompensa de boost enviada com sucesso.",
      flags: 64
    });
  }
};
