import {
  GuildMember,
  AttachmentBuilder,
  EmbedBuilder,
  TextChannel,
  DiscordAPIError
} from "discord.js";

import {
  createCanvas,
  loadImage,
  registerFont
} from "canvas";

import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

// Registra fontes empacotadas no projeto para que a renderização do canvas
// seja idêntica em qualquer ambiente (servidor Linux, container, etc). Sem
// isso, "Sans" depende de uma fonte do sistema que pode não existir em
// produção, fazendo o texto virar quadradinhos (□□□).
const FONT_FAMILY = "DejaVu Sans";
const FONT_FALLBACK = "Noto Sans Arabic";
// Pilha de fontes: usa DejaVu (latino) e cai para Noto Arabic em nomes com
// escrita árabe. Outros alfabetos (ex.: CJK) exigiriam fontes adicionais.
const FONT_STACK = `"${FONT_FAMILY}", "${FONT_FALLBACK}"`;

const BACKGROUND_FALLBACK_URL =
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop";

// Resolve a pasta de assets nos locais possíveis: copiada para dentro do dist
// (deploy só do build) ou na raiz do projeto (deploy completo).
function resolveAssetsDir(): string {
  const baseDir = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    path.join(baseDir, "../assets"),
    path.join(baseDir, "../../assets"),
    path.join(process.cwd(), "assets")
  ];

  return (
    candidates.find((dir) =>
      existsSync(path.join(dir, "fonts/DejaVuSans.ttf"))
    ) ?? candidates[0]!
  );
}

const assetsDir = resolveAssetsDir();
const backgroundPath = path.join(assetsDir, "images/welcome-bg.jpg");

let fontsRegistered = false;

function ensureFontsRegistered() {
  if (fontsRegistered) {
    return;
  }

  try {
    const fontsDir = path.join(assetsDir, "fonts");

    registerFont(path.join(fontsDir, "DejaVuSans.ttf"), {
      family: FONT_FAMILY,
      weight: "normal"
    });

    registerFont(path.join(fontsDir, "DejaVuSans-Bold.ttf"), {
      family: FONT_FAMILY,
      weight: "bold"
    });

    // Fallback opcional para nomes em árabe — só registra se presente, para
    // não quebrar caso esses arquivos não estejam empacotados.
    const notoRegular = path.join(fontsDir, "NotoSansArabic-Regular.ttf");
    const notoBold = path.join(fontsDir, "NotoSansArabic-Bold.ttf");

    if (existsSync(notoRegular)) {
      registerFont(notoRegular, { family: FONT_FALLBACK, weight: "normal" });
    }
    if (existsSync(notoBold)) {
      registerFont(notoBold, { family: FONT_FALLBACK, weight: "bold" });
    }

    fontsRegistered = true;
  } catch (error) {
    console.error(
      "[DISCORD] Falha ao registrar fontes do canvas:",
      error
    );
  }
}

// Evita que nomes muito longos estourem o layout da imagem.
function truncateName(text: string, max = 18): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Carrega o fundo localmente; cai para a URL remota se o arquivo não existir.
async function loadBackground() {
  try {
    if (existsSync(backgroundPath)) {
      return await loadImage(backgroundPath);
    }
  } catch (error) {
    console.error("[DISCORD] Falha ao carregar fundo local, usando remoto:", error);
  }

  return await loadImage(BACKGROUND_FALLBACK_URL);
}

export async function guildMemberAddEvent(member: GuildMember) {
  try {
    const roleId = process.env.AUTO_ROLE_ID!;
    const channelId = process.env.WELCOME_CHANNEL_ID!;

    ensureFontsRegistered();

    await member.roles.add(roleId);

    const channel = member.guild.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    const canvas = createCanvas(1200, 400);
    const ctx = canvas.getContext("2d");

    // Background
    const background = await loadBackground();

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
    ctx.font = `bold 52px ${FONT_STACK}`;
    ctx.fillText("BEM-VINDO", 360, 150);

    ctx.fillStyle = "#ff2d2d";
    ctx.font = `bold 42px ${FONT_STACK}`;
    ctx.fillText(truncateName(member.user.username), 360, 210);

    ctx.fillStyle = "#d1d5db";
    ctx.font = `28px ${FONT_STACK}`;
    ctx.fillText(
      "ao servidor oficial do LS Optimizer",
      360,
      270
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = `22px ${FONT_STACK}`;
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

    await sendWelcomeDm(member);

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

async function sendWelcomeDm(member: GuildMember) {
  const welcomeDmEmbed = new EmbedBuilder()
    .setColor("#ff2d2d")
    .setTitle("Boas-vindas ao LS OPTIMIZER")
    .setThumbnail(member.client.user?.displayAvatarURL({ size: 256 }) ?? null)
    .setDescription(
      [
        "O LS OPTIMIZER é uma plataforma de otimização para melhorar desempenho e experiência no seu uso diário.",
        "",
        "**Como funciona**",
        "Você acessa os recursos da plataforma conforme o plano ativo da sua conta.",
        "",
        "**Como assinar**",
        "Acesse o site oficial do LS OPTIMIZER, escolha seu plano e finalize a assinatura.",
        "",
        "**Já é assinante?**",
        "Use o comando `/vincular` no servidor para conectar sua conta.",
        "Depois da vinculação, você recebe o cargo do seu plano e benefícios exclusivos automaticamente."
      ].join("\n")
    )
    .setFooter({
      text: "Se precisar de ajuda, abra um ticket no servidor."
    });

  try {
    await member.send({
      embeds: [welcomeDmEmbed]
    });
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      error.code === 50007
    ) {
      console.log(
        `[DISCORD] DM fechada para ${member.user.tag}.`
      );
      return;
    }

    console.error(
      `[DISCORD] Erro ao enviar DM de boas-vindas para ${member.user.tag}:`,
      error
    );
  }
}
