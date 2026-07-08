import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

import { requestDiscordLink, confirmDiscordCode } from "../services/tlApi.service.js";
import { addLinkedUser } from "../services/database.service.js";
import { syncUserRolesInAllGuilds } from "../services/sync.service.js";

// Fluxo seguro de "pegar cargo de assinante" pelo painel, todo dentro do canal (sem slash command):
//   botão "verify_start" -> modal do email -> backend manda código pro email
//   -> botão "verify_code_start" -> modal do código -> confirma + libera o cargo.
// Reusa exatamente o backend do /vincular (requestDiscordLink) e do /codigo (confirmDiscordCode + sync).

export async function handleVerifyButton(interaction: ButtonInteraction) {
  if (interaction.customId === "verify_start") {
    const modal = new ModalBuilder()
      .setCustomId("verify_email_modal")
      .setTitle("Verificar assinatura");

    const emailInput = new TextInputBuilder()
      .setCustomId("verify_email")
      .setLabel("Email da sua conta TL Optimizer")
      .setPlaceholder("voce@email.com")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId === "verify_code_start") {
    const modal = new ModalBuilder()
      .setCustomId("verify_code_modal")
      .setTitle("Inserir código");

    const codeInput = new TextInputBuilder()
      .setCustomId("verify_code")
      .setLabel("Código recebido no seu email")
      .setPlaceholder("Ex: A1B2C3")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput)
    );

    await interaction.showModal(modal);
    return;
  }
}

export async function handleVerifyModal(interaction: ModalSubmitInteraction) {
  // Passo 1: recebeu o email -> pede o código pro backend enviar por e-mail.
  if (interaction.customId === "verify_email_modal") {
    await interaction.deferReply({ flags: 64 });
    const email = interaction.fields.getTextInputValue("verify_email").trim();

    try {
      await requestDiscordLink(email, interaction.user.id, interaction.user.username);
    } catch (error: any) {
      await interaction.editReply({
        content: error?.message || "Não foi possível enviar o código. Confira o email e tente novamente."
      });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_code_start")
        .setLabel("Inserir código")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      content:
        `Enviei um código de verificação para **${email}**.\n` +
        "Confira sua caixa de entrada (e a pasta de spam) e clique em **Inserir código** abaixo.",
      components: [row]
    });
    return;
  }

  // Passo 2: recebeu o código -> confirma, sincroniza os cargos e libera o assinante.
  if (interaction.customId === "verify_code_modal") {
    await interaction.deferReply({ flags: 64 });
    const code = interaction.fields.getTextInputValue("verify_code").trim();

    try {
      const data = await confirmDiscordCode(interaction.user.id, code);

      await syncUserRolesInAllGuilds(interaction.client, interaction.user.id, data.plan);

      addLinkedUser({
        discordId: interaction.user.id,
        email: data.email,
        plan: data.plan,
        status: "ACTIVE",
        updatedAt: Date.now()
      });

      await interaction.editReply({
        content: `Conta verificada com sucesso! Seu cargo de assinante (**${data.plan}**) já foi liberado. Aproveite 🎉`
      });
    } catch (error: any) {
      await interaction.editReply({
        content: error?.message || "Código inválido ou expirado. Clique em Verificar assinatura e tente de novo."
      });
    }
    return;
  }
}
