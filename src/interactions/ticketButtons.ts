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

export async function handleTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Esse botão só pode ser usado dentro de um servidor.",
      flags: 64
    });
    return;
  }

  if (interaction.customId === "ticket_open") {
    const existingChannel = interaction.guild.channels.cache.find(
      (channel) =>
        channel.name === `ticket-${interaction.user.id}` &&
        channel.parentId === process.env.TICKET_CATEGORY_ID
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

  const existingChannel = interaction.guild.channels.cache.find(
    (channel) =>
      channel.name === `ticket-${interaction.user.id}` &&
      channel.parentId === categoryId
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
    name: `ticket-${interaction.user.id}`,
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
        "O funcionamento pode variar em feriados.",
        "",
        "**Resumo:**",
        summary,
        "",
        "**Email:**",
        email,
        "",
        "**Descrição:**",
        description
      ].join("\n")
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
    content: `Seu ticket foi criado: ${ticketChannel}`
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

  const messages = await channel.messages.fetch({
    limit: 100
  });

  const sortedMessages = Array.from(messages.values()).sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  const transcript = sortedMessages
    .map((message) => {
      const date = new Date(message.createdTimestamp).toLocaleString("pt-BR");
      const content = message.content || "[sem texto]";
      return `[${date}] ${message.author.tag}: ${content}`;
    })
    .join("\n");

  const file = new AttachmentBuilder(Buffer.from(transcript, "utf-8"), {
    name: `${channel.name}-transcript.txt`
  });

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
    content: "Ticket fechado. A transcrição foi enviada para o canal de logs."
  });

  setTimeout(() => {
    channel.delete("Ticket fechado").catch(console.error);
  }, 3000);
}