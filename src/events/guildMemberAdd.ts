import {
  GuildMember,
  AttachmentBuilder,
  EmbedBuilder,
  TextChannel
} from "discord.js";

import {
  createCanvas,
  loadImage
} from "canvas";

export async function guildMemberAddEvent(member: GuildMember) {
  try {
    const roleId = process.env.AUTO_ROLE_ID!;
    const channelId = process.env.WELCOME_CHANNEL_ID!;

    await member.roles.add(roleId);

    const channel = member.guild.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    const canvas = createCanvas(1200, 400);
    const ctx = canvas.getContext("2d");

    // Background
    const background = await loadImage(
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop"
    );

    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // Overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Barra vermelha
    ctx.fillStyle = "#ff2d2d";
    ctx.fillRect(0, 0, 18, canvas.height);

    // Avatar
    const avatar = await loadImage(
      member.user.displayAvatarURL({
        extension: "png",
        size: 512
      })
    );

    ctx.save();

    ctx.beginPath();
    ctx.arc(220, 200, 90, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(avatar, 130, 110, 180, 180);

    ctx.restore();

    // Borda avatar
    ctx.beginPath();
    ctx.arc(220, 200, 95, 0, Math.PI * 2, true);
    ctx.strokeStyle = "#ff2d2d";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Texto
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px Sans";
    ctx.fillText("BEM-VINDO", 360, 150);

    ctx.fillStyle = "#ff2d2d";
    ctx.font = "bold 42px Sans";
    ctx.fillText(member.user.username, 360, 210);

    ctx.fillStyle = "#d1d5db";
    ctx.font = "28px Sans";
    ctx.fillText(
      "ao servidor oficial do LS Optimizer",
      360,
      270
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "22px Sans";
    ctx.fillText(
      `Membro #${member.guild.memberCount}`,
      360,
      330
    );

    // Exporta imagem
    const attachment = new AttachmentBuilder(
      canvas.toBuffer("image/png"),
      {
        name: "welcome.png"
      }
    );

    // Embed
    const embed = new EmbedBuilder()
      .setColor("#ff2d2d")
      .setDescription(
        `👋 Bem-vindo ${member.user} ao servidor oficial do LS Optimizer.`
      )
      .setImage("attachment://welcome.png")
      .setTimestamp();

    await (channel as TextChannel).send({
      content: `${member.user}`,
      embeds: [embed],
      files: [attachment]
    });

    console.log(
      `[DISCORD] Novo membro: ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      "[DISCORD] Erro no guildMemberAdd:",
      error
    );
  }
}