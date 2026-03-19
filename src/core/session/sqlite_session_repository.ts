import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { SessionRepository } from './repository';
import { SessionAppendInput, SessionMessageRecord, SessionRecord, SessionStartInput, SessionStatus, SessionSummary } from './types';

const require = createRequire(import.meta.url);

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(params?: Record<string, unknown>): any;
    all(params?: Record<string, unknown>): any[];
    run(params?: Record<string, unknown>): any;
  };
};

function resolveDefaultDbPath(): string {
  const base = process.env.CODEAGENT_HOME?.trim() || path.join(os.homedir(), '.codeagent');
  return path.join(base, 'sessions.db');
}

export class SqliteSessionRepository implements SessionRepository {
  private db: SqliteDatabase;

  constructor(dbPath: string = resolveDefaultDbPath()) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });

    this.db = this.openDatabase(dbPath);
    this.init();
  }

  private openDatabase(dbPath: string): SqliteDatabase {
    try {      const bunSqlite = require('bun:sqlite') as { Database: new (path: string) => SqliteDatabase };
      return new bunSqlite.Database(dbPath);
    } catch {      const nodeSqlite = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDatabase };
      return new nodeSqlite.DatabaseSync(dbPath);
    }
  }

  private init() {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        cwd TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_name TEXT,
        tool_payload TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON messages(session_id, seq);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
    `);
  }

  startSession(input: SessionStartInput): SessionRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const status: SessionStatus = 'active';

    this.db.prepare(`
      INSERT INTO sessions (id, title, status, provider, model, cwd, created_at, updated_at)
      VALUES ($id, $title, $status, $provider, $model, $cwd, $createdAt, $updatedAt)
    `).run({
      $id: id,
      $title: input.title,
      $status: status,
      $provider: input.provider,
      $model: input.model,
      $cwd: input.cwd,
      $createdAt: now,
      $updatedAt: now,
    });

    return {
      id,
      title: input.title,
      status,
      provider: input.provider,
      model: input.model,
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
    };
  }

  appendMessage(input: SessionAppendInput): SessionMessageRecord {
    const existing = this.getSession(input.sessionId);
    if (!existing) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const next = this.db.prepare(`
      SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq
      FROM messages
      WHERE session_id = $sessionId
    `).get({ $sessionId: input.sessionId });

    const seq = Number(next?.next_seq || 1);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const payload = input.toolPayload === undefined ? null : JSON.stringify(input.toolPayload);

    this.db.prepare(`
      INSERT INTO messages (id, session_id, seq, role, content, tool_name, tool_payload, created_at)
      VALUES ($id, $sessionId, $seq, $role, $content, $toolName, $toolPayload, $createdAt)
    `).run({
      $id: id,
      $sessionId: input.sessionId,
      $seq: seq,
      $role: input.role,
      $content: input.content,
      $toolName: input.toolName || null,
      $toolPayload: payload,
      $createdAt: createdAt,
    });

    this.db.prepare(`
      UPDATE sessions
      SET updated_at = $updatedAt
      WHERE id = $sessionId
    `).run({ $updatedAt: createdAt, $sessionId: input.sessionId });

    return {
      id,
      sessionId: input.sessionId,
      seq,
      role: input.role,
      content: input.content,
      toolName: input.toolName || null,
      toolPayload: payload,
      createdAt,
    };
  }

  listRecentSessions(limit: number): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT id, title, status, updated_at, provider, model
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT $limit
    `).all({ $limit: Math.max(1, limit) });

    return rows.map((r: any) => ({
      id: String(r.id),
      title: String(r.title),
      status: r.status as SessionStatus,
      updatedAt: String(r.updated_at),
      provider: String(r.provider),
      model: String(r.model),
    }));
  }

  getSession(sessionId: string): SessionRecord | null {
    const row = this.db.prepare(`
      SELECT id, title, status, provider, model, cwd, created_at, updated_at
      FROM sessions
      WHERE id = $sessionId
      LIMIT 1
    `).get({ $sessionId: sessionId });

    if (!row) return null;

    return {
      id: String(row.id),
      title: String(row.title),
      status: row.status as SessionStatus,
      provider: String(row.provider),
      model: String(row.model),
      cwd: String(row.cwd),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  getMessages(sessionId: string): SessionMessageRecord[] {
    const rows = this.db.prepare(`
      SELECT id, session_id, seq, role, content, tool_name, tool_payload, created_at
      FROM messages
      WHERE session_id = $sessionId
      ORDER BY seq ASC
    `).all({ $sessionId: sessionId });

    return rows.map((r: any) => ({
      id: String(r.id),
      sessionId: String(r.session_id),
      seq: Number(r.seq),
      role: r.role,
      content: String(r.content),
      toolName: r.tool_name ? String(r.tool_name) : null,
      toolPayload: r.tool_payload ? String(r.tool_payload) : null,
      createdAt: String(r.created_at),
    }));
  }

  setStatus(sessionId: string, status: SessionStatus): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sessions
      SET status = $status, updated_at = $updatedAt
      WHERE id = $sessionId
    `).run({
      $status: status,
      $updatedAt: now,
      $sessionId: sessionId,
    });
  }
}