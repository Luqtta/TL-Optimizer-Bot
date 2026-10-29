// Check do cargo do TL Playbook (sem framework): npx tsx scripts/check-playbook.ts
// Roda num banco temporario: migracao de banco antigo, upsert que preserva a posse do Playbook nos eventos de
// plano, reprocessamento com a flag, e a guarda que impede o cargo do Playbook de ser um cargo de plano.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tl-bot-check-")), "bot.db");
process.env.BOT_DB_PATH = dbFile;

// Banco ANTIGO (sem a coluna playbook), com um vinculo de plano.
const old = new Database(dbFile);
old.exec(`
  CREATE TABLE linked_users (discord_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', updated_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE webhook_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, discord_id TEXT,
    email TEXT, previous_plan TEXT, new_plan TEXT, processed INTEGER DEFAULT 0, timestamp INTEGER NOT NULL, created_at INTEGER NOT NULL);
  INSERT INTO linked_users VALUES ('1', 'a@x.com', 'MONTHLY', 'ACTIVE', 0, 0);
`);
old.close();

const dbs = await import("../src/services/database.service.js");
dbs.initializeDatabase();

// Migracao: o vinculo antigo continua e nasce sem o Playbook.
assert.equal(dbs.getLinkedUser("1")?.playbook, false);

// Posse concedida; um evento de PLANO depois (upsert sem playbook) NAO apaga a posse.
assert.ok(dbs.updateLinkedUser("1", { playbook: true }));
dbs.addLinkedUser({ discordId: "1", email: "a@x.com", plan: "FREE", status: "EXPIRED", updatedAt: 1 });
assert.equal(dbs.getLinkedUser("1")?.playbook, true, "EXPIRED do plano nao mexe no Playbook");
assert.equal(dbs.getLinkedUser("1")?.plan, "FREE");

// Revogacao e vinculo novo so' do Playbook.
assert.ok(dbs.updateLinkedUser("1", { playbook: false }));
assert.equal(dbs.getLinkedUser("1")?.playbook, false);
dbs.addLinkedUser({ discordId: "2", email: "b@x.com", plan: "FREE", status: "ACTIVE", updatedAt: 1, playbook: true });
assert.equal(dbs.getLinkedUserByEmail("b@x.com")?.playbook, true);
assert.equal(dbs.updateLinkedUser("3", { playbook: true }), false, "sem registro: o webhook cria um");

// Reprocessamento guarda a posse do evento.
dbs.addWebhookEvent({ eventType: "LINKED", discordId: "2", email: "b@x.com", newPlan: "FREE", playbook: true });
dbs.addWebhookEvent({ eventType: "EXPIRED", discordId: "1", email: "a@x.com", newPlan: "FREE" });
const pending = dbs.getPendingWebhookEvents(0);
assert.deepEqual(pending.map((e) => e.playbook), [1, null]);

// Guarda: cargo do Playbook igual a um cargo de plano fica desligado (o sync de plano tiraria ele).
const { playbookRoleId } = await import("../src/services/sync.service.js");
process.env.ROLE_MONTHLY_ID = "100";
process.env.ROLE_PLAYBOOK_ID = "100";
assert.equal(playbookRoleId(), null);
process.env.ROLE_PLAYBOOK_ID = "200";
assert.equal(playbookRoleId(), "200");

// ---- Vinculo permanente, cargos pelo estado atual (eventos, REFUNDED e reconcile) ----
// Cliente do Discord falso: uma guild, um membro "42", os cargos num Set. A DM falha (sem usuario) e e' ignorada.
process.env.ROLE_MONTHLY_ID = "r-mensal";
process.env.ROLE_YEARLY_ID = "r-anual";
process.env.ROLE_PLAYBOOK_ID = "r-playbook";
const { dispatchWebhookEvent } = await import("../src/services/tlWebhook.service.js");
const { reconcileLink } = await import("../src/services/reconcile.service.js");
const { rolePlan } = await import("../src/services/sync.service.js");

const roles = new Set<string>();
const member: any = {
  id: "42",
  user: { tag: "teste#0001" },
  roles: {
    cache: roles,
    add: async (r: string | string[]) => [r].flat().forEach((id) => roles.add(id)),
    remove: async (r: string | string[]) => [r].flat().forEach((id) => roles.delete(id))
  }
};
const guild: any = {
  name: "TL",
  roles: { cache: new Map([["r-mensal", {}], ["r-anual", {}], ["r-playbook", {}]]) },
  members: { fetch: async (id: string) => (id === "42" ? member : Promise.reject(new Error("fora"))) },
  channels: { cache: new Map() }
};
member.guild = guild;
const client: any = {
  guilds: { cache: new Map([["g", guild]]) },
  users: { fetch: async () => { throw new Error("sem DM no check"); } },
  channels: { fetch: async () => null }
};

let t = 1;
const ev = (type: string, extra: Record<string, unknown>) =>
  dispatchWebhookEvent(client, { type, discordId: "42", email: "c@x.com", timestamp: t++, ...extra } as any);
const cargos = () => [...roles].sort().join(",");
const reset = () => { roles.clear(); dbs.removeLinkedUser("42"); };

// 1. Vinculou so' com o Playbook -> compra plano depois: ganha o do plano e mantem o do Playbook.
reset();
await ev("LINKED", { newPlan: "FREE", subscriptionStatus: "ACTIVE", playbook: true });
assert.equal(cargos(), "r-playbook");
await ev("UPGRADED", { previousPlan: "FREE", newPlan: "MONTHLY", subscriptionStatus: "ACTIVE", playbook: true });
assert.equal(cargos(), "r-mensal,r-playbook", "1");

// Vinculou pelo Playbook com o plano VENCIDO: o cargo do plano vencido nao vem junto.
reset();
await ev("LINKED", { newPlan: "MONTHLY", subscriptionStatus: "EXPIRED", playbook: true });
assert.equal(cargos(), "r-playbook");

// 2. Vinculou so' com plano -> compra o Playbook depois: ganha o do Playbook.
reset();
await ev("LINKED", { newPlan: "MONTHLY", subscriptionStatus: "ACTIVE", playbook: false });
assert.equal(cargos(), "r-mensal");
await ev("PLAYBOOK_GRANTED", { newPlan: "MONTHLY", subscriptionStatus: "ACTIVE", playbook: true });
assert.equal(cargos(), "r-mensal,r-playbook", "2");

// 3. Plano expira ou e' estornado: sai so' o do plano.
await ev("EXPIRED", { previousPlan: "MONTHLY", newPlan: "MONTHLY", subscriptionStatus: "EXPIRED", playbook: true });
assert.equal(cargos(), "r-playbook", "3 expirou");
await ev("UPGRADED", { previousPlan: "FREE", newPlan: "YEARLY", subscriptionStatus: "ACTIVE", playbook: true });
assert.equal(cargos(), "r-anual,r-playbook");
await ev("REFUNDED", { previousPlan: "YEARLY", newPlan: "YEARLY", subscriptionStatus: "ACTIVE", playbook: true });
assert.equal(cargos(), "r-anual,r-playbook", "estorno de 1 de varios periodos: o plano segue ativo");
await ev("REFUNDED", { previousPlan: "YEARLY", newPlan: "YEARLY", subscriptionStatus: "INACTIVE", playbook: true });
assert.equal(cargos(), "r-playbook", "3 estornou");
assert.ok(dbs.getLinkedUser("42"), "estorno nao desfaz o vinculo");

// 4. Playbook revogado: sai so' o do Playbook.
await ev("UPGRADED", { previousPlan: "FREE", newPlan: "MONTHLY", subscriptionStatus: "ACTIVE", playbook: true });
await ev("PLAYBOOK_REVOKED", { newPlan: "MONTHLY", subscriptionStatus: "ACTIVE", playbook: false });
assert.equal(cargos(), "r-mensal", "4");

// 5. Sem plano e sem Playbook: continua vinculado e sem cargos; comprou de novo, cargo sem vincular de novo.
await ev("REFUNDED", { previousPlan: "MONTHLY", newPlan: "MONTHLY", subscriptionStatus: "INACTIVE", playbook: false });
assert.equal(cargos(), "", "5 sem cargos");
assert.ok(dbs.getLinkedUser("42"), "5 continua vinculado");
await ev("PLAYBOOK_GRANTED", { newPlan: "MONTHLY", subscriptionStatus: "INACTIVE", playbook: true });
assert.equal(cargos(), "r-playbook");
await ev("UPGRADED", { previousPlan: "FREE", newPlan: "MONTHLY", subscriptionStatus: "ACTIVE", playbook: true });
assert.equal(cargos(), "r-mensal,r-playbook", "5 comprou de novo");

// Reconcile (a cada 30 min): cargos pelo estado do backend, vinculo nunca sai.
const rec = (status: string, playbook: boolean) => reconcileLink(client, { discordId: "42", plan: "MONTHLY", status, playbook });
await rec("INACTIVE", true);
assert.equal(cargos(), "r-playbook", "reconcile: estornado/revogado nao tem cargo de plano");
await rec("CANCELED", true);
assert.equal(cargos(), "r-mensal,r-playbook", "reconcile: cancelado vale ate' vencer");
await rec("EXPIRED", false);
assert.equal(cargos(), "", "reconcile: sem nada, sem cargos");
assert.equal(dbs.getLinkedUser("42")?.playbook, false, "reconcile acerta a flag local do anti-tamper");
assert.ok(dbs.getLinkedUser("42"));

assert.equal(rolePlan("MONTHLY", undefined), "MONTHLY", "evento antigo sem status: como antes");
assert.equal(rolePlan(null, "ACTIVE"), "FREE");

dbs.closeDatabase();
console.log("check-playbook: ok");
