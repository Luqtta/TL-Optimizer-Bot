export interface LinkedUser {
  discordId: string;
  email: string;
  // QUARTERLY = Trimestral. Chega cru do backend; so' o anual vira "YEARLY" na saida dele.
  plan: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "LIFETIME" | "FREE";
  status: "ACTIVE" | "CANCELED" | "EXPIRED";
  updatedAt: number;
  // Posse ATIVA do TL Playbook (cargo proprio, independente do plano). undefined no upsert = mantem o que ja' tinha.
  playbook?: boolean;
}

export interface WebhookEvent {
  type: "LINKED" | "UNLINKED" | "UPGRADED" | "DOWNGRADED" | "RENEWED" | "CANCELED" | "REACTIVATED" | "EXPIRED" | "REFUNDED" | "ACCOUNT_DELETED"
    | "PLAYBOOK_GRANTED" | "PLAYBOOK_REVOKED";
  discordId: string;
  email: string;
  previousPlan?: string;
  newPlan?: string;
  // Posse ativa do Playbook no momento do envio (vem em todo evento do backend; ausente em evento antigo).
  playbook?: boolean;
  subscriptionStatus?: string;
  timestamp: number;
}

export interface SyncResult {
  success: boolean;
  action?: "ADDED_ROLE" | "REMOVED_ROLE" | "UPDATED_ROLE" | "NO_ACTION";
  reason?: string;
}

export interface Giveaway {
  messageId: string;
  channelId: string;
  guildId: string;
  prize: string;
  winnersCount: number;
  minParticipants: number;
  endAt: number;
  hostId: string;
  status: "ACTIVE" | "ENDED" | "CANCELED";
}
