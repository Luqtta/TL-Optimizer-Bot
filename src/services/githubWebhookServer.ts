import type { Express } from "express";
import crypto from "crypto";

import {
  Client,
  EmbedBuilder,
  TextChannel
} from "discord.js";

// Comparação em tempo constante para evitar timing attacks na assinatura.
function timingSafeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function registerGithubWebhookRoutes(app: Express, client: Client) {
  app.post("/webhooks/github", async (req: any, res) => {
    try {
      const signature = req.headers["x-hub-signature-256"];
      const secret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!signature || typeof signature !== "string" || !secret) {
        return res.sendStatus(401);
      }

      const hmac = crypto.createHmac("sha256", secret);
      const digest =
        "sha256=" +
        hmac.update(req.rawBody).digest("hex");

      if (!timingSafeCompare(signature, digest)) {
        console.log("[GITHUB] Assinatura inválida.");
        return res.sendStatus(401);
      }

      const event = req.headers["x-github-event"];

      if (event !== "release") {
        return res.sendStatus(200);
      }

      const payload = req.body;

      if (payload.action !== "published") {
        return res.sendStatus(200);
      }

      const release = payload.release;

      const channelId = process.env.FEATURE_CHANNEL_ID;

      if (!channelId) {
        console.log("[GITHUB] FEATURE_CHANNEL_ID não configurado.");
        return res.sendStatus(500);
      }

      const channel =
        client.channels.cache.get(channelId);

      if (!channel || !(channel instanceof TextChannel)) {
        console.log("[GITHUB] Canal de features inválido.");
        return res.sendStatus(500);
      }

      // Anúncio enxuto: título (sem link), versão e a descrição da release. Nada de
      // repositório/URL do GitHub — o canal é vitrine de novidades, não de código.
      const embed = new EmbedBuilder()
        .setColor("#3b82f6")
        .setTitle(`Nova atualização • ${release.name}`)
        .setDescription(
          release.body?.slice(0, 4000) ||
          "Sem descrição."
        )
        .addFields({
          name: "Versão",
          value: release.tag_name,
          inline: true
        })
        .setTimestamp();

      await channel.send({
        embeds: [embed]
      });

      console.log(
        `[GITHUB] Release enviada: ${release.tag_name}`
      );

      return res.sendStatus(200);

    } catch (error) {
      console.error(
        "[GITHUB] Erro no webhook:",
        error
      );

      return res.sendStatus(500);
    }
  });

}