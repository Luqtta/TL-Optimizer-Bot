import type {
  GuildMember,
  PartialGuildMember
} from "discord.js";

import { getLinkedUser } from "../services/database.service.js";
import {
  logSyncAction,
  syncUserRoles,
  isBotManagedSync
} from "../services/sync.service.js";

// Anti-tampering de cargos de plano.
//
// Quando um cargo pago (mensal/anual/vitalício) é adicionado ou removido de um
// membro, comparamos o estado atual com o que o banco diz que ele deveria ter:
//   - Sempre registra um alerta no canal de logs quando há divergência.
//   - Se ANTI_TAMPER_ENFORCE="true", também REVERTE para o estado correto.
//
// É idempotente: quando os cargos já batem com o esperado, não faz nada — por
// isso não entra em loop com as próprias sincronizações do bot.
export async function guildMemberUpdateEvent(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  try {
    const planRoleIds = {
      WEEKLY: process.env.ROLE_WEEKLY_ID,
      MONTHLY: process.env.ROLE_MONTHLY_ID,
      YEARLY: process.env.ROLE_YEARLY_ID,
      LIFETIME: process.env.ROLE_LIFETIME_ID
    };

    const managedIds = Object.values(planRoleIds).filter(Boolean) as string[];

    if (managedIds.length === 0) {
      return;
    }

    // Só age se algum cargo gerenciado realmente mudou (evita rodar em troca
    // de apelido, etc). Se o oldMember for parcial, o gate pode dar falso
    // positivo, mas a checagem de divergência abaixo impede alerta indevido.
    const roleChanged = managedIds.some(
      (id) => oldMember.roles?.cache?.has(id) !== newMember.roles.cache.has(id)
    );

    if (!roleChanged) {
      return;
    }

    // Foi o próprio bot que mudou os cargos agora? Então não é manipulação.
    if (isBotManagedSync(newMember.id)) {
      return;
    }

    const linked = getLinkedUser(newMember.id);

    // CANCELED mantém o cargo até expirar (regra do webhook). Só EXPIRED ou
    // ausência de vínculo significam "sem cargo".
    const entitled = !!linked && linked.status !== "EXPIRED";
    const expectedPlan = entitled ? linked!.plan : "FREE";
    const expectedRoleId =
      expectedPlan === "FREE"
        ? null
        : planRoleIds[expectedPlan as "WEEKLY" | "MONTHLY" | "YEARLY" | "LIFETIME"] ?? null;

    const currentManaged = managedIds.filter((id) =>
      newMember.roles.cache.has(id)
    );

    const isCorrect = expectedRoleId
      ? currentManaged.length === 1 && currentManaged[0] === expectedRoleId
      : currentManaged.length === 0;

    if (isCorrect) {
      return;
    }

    const enforce = process.env.ANTI_TAMPER_ENFORCE === "true";
    const reason =
      `Cargos de plano divergentes para ${newMember.user.tag}. ` +
      `Banco: ${expectedPlan} (status ${linked?.status ?? "NÃO VINCULADO"}). ` +
      `Cargos atuais: ${currentManaged.length > 0 ? currentManaged.join(", ") : "nenhum"}.`;

    if (enforce) {
      await syncUserRoles(newMember, expectedPlan, expectedPlan);
      await logSyncAction(newMember.guild, {
        discordId: newMember.id,
        action: "ANTI_TAMPER_ENFORCED",
        reason: `${reason} → revertido para ${expectedPlan}.`,
        success: true
      });
      console.warn(`[ANTI-TAMPER] Revertido: ${reason}`);
    } else {
      await logSyncAction(newMember.guild, {
        discordId: newMember.id,
        action: "ANTI_TAMPER_DETECTED",
        reason: `${reason} (apenas alerta; defina ANTI_TAMPER_ENFORCE=true para reverter)`,
        success: false
      });
      console.warn(`[ANTI-TAMPER] Detectado: ${reason}`);
    }
  } catch (error: any) {
    console.error(
      "[ANTI-TAMPER] Erro no guildMemberUpdate:",
      error?.message ?? error
    );
  }
}
