import {
  EmbedBuilder,
  Client,
  User
} from "discord.js";

export interface DMNotificationOptions {
  title: string;
  description: string;
  color: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

const eventColors = {
  LINKED: "#00FF00", // verde
  UNLINKED: "#FF6B6B", // vermelho
  UPGRADED: "#4ECDC4", // turquesa
  DOWNGRADED: "#FFD93D", // amarelo
  RENEWED: "#6BCB77", // verde claro
  CANCELED: "#FFA07A", // salmão
  REACTIVATED: "#95E1D3", // verde menta
  EXPIRED: "#FF6B9D", // rosa
  REFUNDED: "#C7CEEA" // lavanda
};

// Logo do TL Optimizer no rodapé das DMs de notificação (host permanente no site).
const LOGO_URL = "https://thelite.com.br/logo-email.png";

export async function sendSyncNotification(
  client: Client,
  discordId: string,
  event: string,
  details?: Record<string, string>
) {
  try {
    const user = await client.users.fetch(discordId);

    if (!user) {
      console.warn(`[DM] Usuário ${discordId} não encontrado.`);
      return false;
    }

    const embed = createSyncEmbed(event, details);

    try {
      await user.send({ embeds: [embed] });
      console.log(`[DM] Notificação enviada para ${user.tag} (${event})`);
      return true;
    } catch (error: any) {
      console.error(
        `[DM] Falha ao enviar DM para ${user.tag}: ${error.message}`
      );
      return false;
    }
  } catch (error: any) {
    console.error(
      `[DM] Erro ao buscar usuário ${discordId}: ${error.message}`
    );
    return false;
  }
}

function createSyncEmbed(
  event: string,
  details?: Record<string, string>
): EmbedBuilder {
  const color = (eventColors as any)[event] || "#5865F2";

  const embedData: DMNotificationOptions = {
    title: "",
    description: "",
    color: color,
    fields: []
  };

  switch (event) {
    case "LINKED":
      embedData.title = "✅ Conta Vinculada";
      embedData.description =
        "Sua conta Discord foi vinculada com sucesso à TL Optimizer!";
      break;

    case "UNLINKED":
      embedData.title = "🔗 Vinculação Removida";
      embedData.description =
        "Sua conta foi desvinculada de TL Optimizer. Seus cargos premium foram removidos.";
      break;

    case "UPGRADED":
      embedData.title = "⬆️ Plano Atualizado";
      embedData.description = `Parabéns! Seu plano foi atualizado para **${details?.newPlan || "Premium"}**`;
      if (details?.previousPlan) {
        embedData.fields = [
          { name: "Plano Anterior", value: details.previousPlan, inline: true },
          { name: "Novo Plano", value: details.newPlan || "Premium", inline: true }
        ];
      }
      break;

    case "DOWNGRADED":
      embedData.title = "⬇️ Plano Reduzido";
      embedData.description = "Seu plano foi reduzido.";
      if (details?.previousPlan && details?.newPlan) {
        embedData.fields = [
          { name: "Plano Anterior", value: details.previousPlan, inline: true },
          { name: "Novo Plano", value: details.newPlan, inline: true }
        ];
      }
      break;

    case "RENEWED":
      embedData.title = "🔄 Renovação Processada";
      embedData.description =
        "Sua assinatura foi renovada com sucesso!";
      if (details?.plan) {
        embedData.fields = [
          { name: "Plano", value: details.plan, inline: true }
        ];
      }
      break;

    case "CANCELED":
      embedData.title = "⏸️ Assinatura Cancelada";
      embedData.description =
        "Sua assinatura foi cancelada. Seus benefícios permanecerão ativos até o vencimento.";
      break;

    case "REACTIVATED":
      embedData.title = "✨ Assinatura Reativada";
      embedData.description =
        "Sua assinatura foi reativada com sucesso!";
      if (details?.plan) {
        embedData.fields = [
          { name: "Plano", value: details.plan, inline: true }
        ];
      }
      break;

    case "EXPIRED":
      embedData.title = "⏰ Assinatura Expirada";
      embedData.description =
        "Sua assinatura expirou. Seus cargos premium foram removidos.";
      embedData.fields = [
        {
          name: "Próximos Passos",
          value: "Você pode [renovar sua assinatura](https://thelite.com.br/checkout) a qualquer momento."
        }
      ];
      break;

    case "REFUNDED":
      embedData.title = "💰 Reembolso Processado";
      embedData.description =
        "Seu reembolso foi processado com sucesso. Seus benefícios foram removidos.";
      break;

    default:
      embedData.title = "📢 Notificação do Sistema";
      embedData.description = "Uma ação foi realizada em sua conta.";
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(embedData.title)
    .setDescription(embedData.description)
    .setFooter({
      text: "TL Optimizer • Sincronização",
      iconURL: LOGO_URL
    })
    .setTimestamp();

  if (embedData.fields && embedData.fields.length > 0) {
    embed.addFields(...embedData.fields);
  }

  return embed;
}
