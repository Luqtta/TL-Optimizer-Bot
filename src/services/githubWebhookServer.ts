import express from "express";
import crypto from "crypto";

import {
  Client,
  EmbedBuilder,
  TextChannel
} from "discord.js";

export function startGithubWebhookServer(client: Client) {
  const app = express();

  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  app.post("/webhooks/github", async (req: any, res) => {
    try {
      const signature = req.headers["x-hub-signature-256"];
      const secret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!signature || !secret) {
        return res.sendStatus(401);
      }

      const hmac = crypto.createHmac("sha256", secret);
      const digest =
        "sha256=" +
        hmac.update(req.rawBody).digest("hex");

      if (signature !== digest) {
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

      const embed = new EmbedBuilder()
        .setColor("#ff2d2d")
        .setTitle(`Nova atualização • ${release.name}`)
        .setURL(release.html_url)
        .setDescription(
          release.body?.slice(0, 4000) ||
          "Sem descrição."
        )
        .addFields(
          {
            name: "Versão",
            value: release.tag_name,
            inline: true
          },
          {
            name: "Repositório",
            value: payload.repository.full_name,
            inline: true
          }
        )
        .setFooter({
          text: "LS Optimizer • GitHub Releases"
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

  const port =
    Number(process.env.PORT) || 3001;

  app.listen(port, "0.0.0.0", () => {
    console.log(
      `[GITHUB] Webhook server rodando em 0.0.0.0:${port}`
    );
  });
}