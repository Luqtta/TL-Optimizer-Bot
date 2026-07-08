import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

function ticketChannelName(username: string) {
  // Discord só aceita minúsculas, números, hífen e underscore em nome de canal
  return `ticket-${username.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
}

// O nome do canal usa o username (pode colidir depois de sanitizado),
// então o dono de verdade fica registrado no tópico: "Ticket de tag | ID: 123".
function findUserTicket(
  guild: ButtonInteraction["guild"] & {},
  userId: string,
  categoryId: string | undefined
) {
  return guild.channels.cache.find(
    (channel) =>
      channel.parentId === categoryId &&
      channel.type === ChannelType.GuildText &&
      !!channel.topic?.endsWith(`ID: ${userId}`)
  );
}

export async function handleTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Esse botão só pode ser usado dentro de um servidor.",
      flags: 64
    });
    return;
  }

  if (interaction.customId === "ticket_open") {
    const existingChannel = findUserTicket(
      interaction.guild,
      interaction.user.id,
      process.env.TICKET_CATEGORY_ID
    );

    if (existingChannel) {
      await interaction.reply({
        content: `Você já possui um ticket aberto: ${existingChannel}`,
        flags: 64
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("ticket_create_modal")
      .setTitle("Abrir Ticket");

    const summaryInput = new TextInputBuilder()
      .setCustomId("ticket_summary")
      .setLabel("Resumo do problema")
      .setPlaceholder("Ex: Não consigo fazer login no app")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const emailInput = new TextInputBuilder()
      .setCustomId("ticket_email")
      .setLabel("Email da conta TL Optimizer")
      .setPlaceholder("Ex: seuemail@gmail.com")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId("ticket_description")
      .setLabel("Descreva melhor o problema")
      .setPlaceholder("Explique o que aconteceu, quando começou e se apareceu algum erro.")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(summaryInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
  }

  if (interaction.customId === "ticket_close") {
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close_confirm")
        .setLabel("Confirmar fechamento")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      content:
        "Tem certeza que deseja fechar este ticket? O canal será apagado e a transcrição enviada.",
      components: [confirmRow],
      flags: 64
    });
  }

  if (interaction.customId === "ticket_close_confirm") {
    await closeTicket(interaction);
  }
}

export async function handleTicketModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Esse modal só pode ser usado dentro de um servidor.",
      flags: 64
    });
    return;
  }

  if (interaction.customId !== "ticket_create_modal") return;

  await interaction.deferReply({
    flags: 64
  });

  const categoryId = process.env.TICKET_CATEGORY_ID;
  const supportRoleId = process.env.SUPPORT_ROLE_ID;

  if (!categoryId) {
    await interaction.editReply({
      content: "Sistema de tickets não configurado. Defina TICKET_CATEGORY_ID no .env."
    });
    return;
  }

  const existingChannel = findUserTicket(
    interaction.guild,
    interaction.user.id,
    categoryId
  );

  if (existingChannel) {
    await interaction.editReply({
      content: `Você já possui um ticket aberto: ${existingChannel}`
    });
    return;
  }

  const summary = interaction.fields.getTextInputValue("ticket_summary");
  const email =
    interaction.fields.getTextInputValue("ticket_email") || "Não informado";
  const description = interaction.fields.getTextInputValue("ticket_description");

  const permissionOverwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  if (supportRoleId) {
    permissionOverwrites.push({
      id: supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  const ticketChannel = await interaction.guild.channels.create({
    name: ticketChannelName(interaction.user.username),
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `Ticket de ${interaction.user.tag} | ID: ${interaction.user.id}`,
    permissionOverwrites
  });

  const embed = new EmbedBuilder()
    .setColor("#3b82f6")
    .setTitle("Ticket aberto")
    .setDescription(
      [
        `${interaction.user}, seu ticket foi criado com sucesso.`,
        "",
        "**Horário de atendimento:**",
        "Segunda a sábado, das 06:00 às 18:00.",
        "O funcionamento pode variar em feriados."
      ].join("\n")
    )
    .addFields(
      { name: "Resumo", value: summary },
      { name: "Email", value: email, inline: true },
      { name: "Descrição", value: description }
    )
    .setFooter({
      text: "TL Optimizer • Suporte"
    })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Fechar Ticket")
      .setStyle(ButtonStyle.Secondary)
  );

  await ticketChannel.send({
    content: supportRoleId
      ? `${interaction.user} <@&${supportRoleId}>`
      : `${interaction.user}`,
    embeds: [embed],
    components: [row]
  });

  await interaction.editReply({
    content: `Seu ticket foi criado: ${ticketChannel}\nQuando ele for fechado, você recebe a transcrição no privado.`
  });
}

async function closeTicket(interaction: ButtonInteraction) {
  const channel = interaction.channel;

  if (!interaction.guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "Esse botão só pode ser usado dentro de um canal de ticket.",
      flags: 64
    });
    return;
  }

  if (!channel.name.startsWith("ticket-")) {
    await interaction.reply({
      content: "Esse canal não parece ser um ticket.",
      flags: 64
    });
    return;
  }

  await interaction.deferReply({
    flags: 64
  });

  const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;
  const logChannel = logChannelId
    ? interaction.guild.channels.cache.get(logChannelId)
    : null;

  // O fetch é limitado a 100 por chamada — pagina até pegar o canal inteiro.
  const allMessages = [];
  let before: string | undefined;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    allMessages.push(...batch.values());
    before = batch.last()!.id;
    if (batch.size < 100) break;
  }

  const sortedMessages = allMessages.sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  const transcript = sortedMessages
    .map((message) => {
      const date = new Date(message.createdTimestamp).toLocaleString("pt-BR");
      const parts = [
        message.content,
        ...message.attachments.map((attachment) => `[anexo] ${attachment.url}`),
        ...message.embeds.map(
          (embed) => `[embed] ${embed.title ?? ""} ${embed.description ?? ""}`.trim()
        )
      ].filter(Boolean);
      return `[${date}] ${message.author.tag}: ${parts.join("\n  ") || "[sem texto]"}`;
    })
    .join("\n");

  const file = new AttachmentBuilder(Buffer.from(transcript, "utf-8"), {
    name: `${channel.name}-transcript.txt`
  });

  // Manda a transcrição no privado do dono do ticket, pra ele ficar com o registro.
  // O ID do dono fica no tópico do canal ("Ticket de tag | ID: 123").
  const ownerId = channel.topic?.match(/ID: (\d+)/)?.[1];
  let dmSent = false;
  try {
    if (!ownerId) throw new Error("owner not found");
    const owner = await interaction.client.users.fetch(ownerId);
    await owner.send({
      content:
        "Seu ticket no TL Optimizer foi fechado. Aqui está a transcrição completa da conversa:",
      files: [
        new AttachmentBuilder(Buffer.from(transcript, "utf-8"), {
          name: `${channel.name}-transcript.txt`
        })
      ]
    });
    dmSent = true;
  } catch {
    // DM fechada / bloqueada / usuário saiu do servidor
  }

  if (logChannel && logChannel.type === ChannelType.GuildText) {
    const embed = new EmbedBuilder()
      .setColor("#3b82f6")
      .setTitle("Ticket fechado")
      .addFields(
        {
          name: "Canal",
          value: channel.name,
          inline: true
        },
        {
          name: "Fechado por",
          value: `${interaction.user}`,
          inline: true
        }
      )
      .setTimestamp();

    await (logChannel as TextChannel).send({
      embeds: [embed],
      files: [file]
    });
  }

  await interaction.editReply({
    content: dmSent
      ? "Ticket fechado. A transcrição foi enviada para o canal de logs e para o privado do usuário."
      : "Ticket fechado. A transcrição foi enviada para o canal de logs (não consegui enviar no privado do usuário — DMs fechadas)."
  });

  setTimeout(() => {
    channel.delete("Ticket fechado").catch(console.error);
  }, 3000);
}