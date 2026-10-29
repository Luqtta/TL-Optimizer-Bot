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

dbs.closeDatabase();
console.log("check-playbook: ok");
