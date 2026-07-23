export interface LinkedUser {
  discordId: string;
  email: string;
  plan: "WEEKLY" | "MONTHLY" | "YEARLY" | "LIFETIME" | "FREE";
  status: "ACTIVE" | "CANCELED" | "EXPIRED";
  updatedAt: number;
}

export interface WebhookEvent {
  type: "LINKED" | "UNLINKED" | "UPGRADED" | "DOWNGRADED" | "RENEWED" | "CANCELED" | "REACTIVATED" | "EXPIRED" | "REFUNDED" | "ACCOUNT_DELETED";
  discordId: string;
  email: string;
  previousPlan?: string;
  newPlan?: string;
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
