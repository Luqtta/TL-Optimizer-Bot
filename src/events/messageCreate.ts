import {
  EmbedBuilder,
  Message,
  PermissionFlagsBits,
  TextChannel
} from "discord.js";

const inviteRegex =
  /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;

const SUGGESTION_CHANNEL_ID = process.env.SUGGESTION_CHANNEL_ID;

export async function messageCreateEvent(message: Message) {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    /*
     * =========================
     * SISTEMA DE SUGESTÕES
     * =========================
     */

    if (message.channel.id === SUGGESTION_CHANNEL_ID) {
      const content = message.content.trim();

      if (!content.length) {
        await message.delete().catch(() => {});
        return;
      }

      await message.delete().catch(() => {});

      const embed = new EmbedBuilder()
        .setColor("#3b82f6")
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL()
        })
        .setTitle("Nova sugestão")
        .setDescription(content)
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({
          text: `ID do usuário: ${message.author.id}`
        })
        .setTimestamp();

      const suggestionMessage = await (
        message.channel as TextChannel
      ).send({
        embeds: [embed]
      });

      await suggestionMessage.react("✅");
      await suggestionMessage.react("❌");

      console.log(
        `[SUGESTÃO] ${message.author.tag}: ${content}`
      );

      return;
    }

    /*
     * =========================
     * ANTI CONVITE
     * =========================
     */

    const member = message.member;

    if (!member) return;

    const isAdmin = member.permissions.has(
      PermissionFlagsBits.Administrator
    );

    const isModerator = member.permissions.has(
      PermissionFlagsBits.ModerateMembers
    );

    if (isAdmin || isModerator) return;

    // Canal/categoria de divulgação: convites de Discord são liberados aqui.
    // Funciona tanto se SHARE_CATEGORY_ID for uma categoria (cobre os canais
    // dentro dela) quanto se for o próprio canal.
    const shareCategoryId = process.env.SHARE_CATEGORY_ID;
    const channelParentId =
      "parentId" in message.channel ? message.channel.parentId : null;

    if (
      shareCategoryId &&
      (message.channel.id === shareCategoryId ||
        channelParentId === shareCategoryId)
    ) {
      return;
    }

    if (!inviteRegex.test(message.content)) return;

    await message.delete().catch(() => {});

    if (!message.channel.isSendable()) return;

    const warning = await message.channel.send({
      content: `${message.author}, links de convite não são permitidos neste servidor.`
    });

    setTimeout(() => {
      warning.delete().catch(() => {});
    }, 7000);

    console.log(
      `[ANTI-INVITE] ${message.author.tag} tentou enviar convite em #${message.channel}`
    );

  } catch (error) {
    console.error("[DISCORD] Erro no messageCreate:", error);
  }
}