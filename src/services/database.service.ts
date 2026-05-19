import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import type { LinkedUser } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/bot.db");

let db: any = null;

export function initializeDatabase(): void {
  db = new Database(dbPath);
  
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS linked_users (
      discord_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL CHECK(plan IN ('MONTHLY', 'YEARLY', 'LIFETIME', 'FREE')),
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'CANCELED', 'EXPIRED')) DEFAULT 'ACTIVE',
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      discord_id TEXT,
      email TEXT,
      previous_plan TEXT,
      new_plan TEXT,
      processed INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      success INTEGER,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_linked_users_email ON linked_users(email);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_discord_id ON webhook_events(discord_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
  `);

  console.log("[DATABASE] Banco de dados inicializado em:", dbPath);
}

export function getDatabase(): any {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return db;
}

// LINKED USERS

export function addLinkedUser(user: LinkedUser): boolean {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO linked_users (discord_id, email, plan, status, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      user.discordId,
      user.email,
      user.plan,
      user.status || "ACTIVE",
      user.updatedAt,
      Date.now()
    );

    return result.changes > 0;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao adicionar usuário vinculado:", error.message);
    return false;
  }
}

export function getLinkedUser(discordId: string): LinkedUser | null {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT discord_id as discordId, email, plan, status, updated_at as updatedAt
      FROM linked_users
      WHERE discord_id = ?
    `);

    return stmt.get(discordId) as LinkedUser | undefined || null;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao buscar usuário vinculado:", error.message);
    return null;
  }
}

export function getLinkedUserByEmail(email: string): LinkedUser | null {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT discord_id as discordId, email, plan, status, updated_at as updatedAt
      FROM linked_users
      WHERE email = ?
    `);

    return stmt.get(email) as LinkedUser | undefined || null;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao buscar usuário por email:", error.message);
    return null;
  }
}

export function getAllLinkedUsers(): LinkedUser[] {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      SELECT discord_id as discordId, email, plan, status, updated_at as updatedAt
      FROM linked_users
      ORDER BY updated_at DESC
    `);

    return stmt.all() as LinkedUser[];
  } catch (error: any) {
    console.error("[DATABASE] Erro ao buscar todos os usuários:", error.message);
    return [];
  }
}

export function updateLinkedUser(discordId: string, updates: Partial<Omit<LinkedUser, "discordId">>): boolean {
  const db = getDatabase();

  try {
    const parts: string[] = [];
    const values: any[] = [];

    if (updates.email !== undefined) {
      parts.push("email = ?");
      values.push(updates.email);
    }
    if (updates.plan !== undefined) {
      parts.push("plan = ?");
      values.push(updates.plan);
    }
    if (updates.status !== undefined) {
      parts.push("status = ?");
      values.push(updates.status);
    }

    parts.push("updated_at = ?");
    values.push(Date.now());

    values.push(discordId);

    const stmt = db.prepare(`
      UPDATE linked_users
      SET ${parts.join(", ")}
      WHERE discord_id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao atualizar usuário vinculado:", error.message);
    return false;
  }
}

export function removeLinkedUser(discordId: string): boolean {
  const db = getDatabase();

  try {
    const stmt = db.prepare("DELETE FROM linked_users WHERE discord_id = ?");
    const result = stmt.run(discordId);
    return result.changes > 0;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao remover usuário vinculado:", error.message);
    return false;
  }
}

// WEBHOOK EVENTS

export function addWebhookEvent(event: {
  eventType: string;
  discordId?: string;
  email?: string;
  previousPlan?: string;
  newPlan?: string;
}): number {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      INSERT INTO webhook_events (event_type, discord_id, email, previous_plan, new_plan, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.eventType,
      event.discordId || null,
      event.email || null,
      event.previousPlan || null,
      event.newPlan || null,
      Date.now(),
      Date.now()
    );

    return result.lastInsertRowid as number;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao adicionar webhook event:", error.message);
    return -1;
  }
}

export function markWebhookEventAsProcessed(eventId: number): boolean {
  const db = getDatabase();

  try {
    const stmt = db.prepare("UPDATE webhook_events SET processed = 1 WHERE id = ?");
    const result = stmt.run(eventId);
    return result.changes > 0;
  } catch (error: any) {
    console.error("[DATABASE] Erro ao marcar evento como processado:", error.message);
    return false;
  }
}

// SYNC LOGS

export function addSyncLog(log: {
  discordId?: string;
  action: string;
  reason?: string;
  success: boolean;
}): void {
  const db = getDatabase();

  try {
    const stmt = db.prepare(`
      INSERT INTO sync_logs (discord_id, action, reason, success, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.discordId || null,
      log.action,
      log.reason || null,
      log.success ? 1 : 0,
      Date.now()
    );
  } catch (error: any) {
    console.error("[DATABASE] Erro ao adicionar sync log:", error.message);
  }
}

export function getSyncLogs(discordId?: string, limit: number = 100): any[] {
  const db = getDatabase();

  try {
    let stmt;
    if (discordId) {
      stmt = db.prepare(`
        SELECT * FROM sync_logs
        WHERE discord_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      return stmt.all(discordId, limit) as any[];
    } else {
      stmt = db.prepare(`
        SELECT * FROM sync_logs
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      return stmt.all(limit) as any[];
    }
  } catch (error: any) {
    console.error("[DATABASE] Erro ao buscar sync logs:", error.message);
    return [];
  }
}
