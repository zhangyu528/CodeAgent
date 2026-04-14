/**
 * Session Repository — N4 Storage Abstraction Layer
 * 
 * Provides an abstraction over session persistence, enabling future
 * SQLite/better-sqlite3 implementation without changing calling code.
 * Currently wraps the JSON-file-based storage from sessions.ts.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { AgentMessage } from '@mariozechner/pi-agent-core';
import { CONFIG_DIR, SESSIONS_DIR, SESSION_VERSION } from './constants.js';
import {
  isValidSessionId,
  extractMessageText,
  removeFileWithRetry,
  atomicWriteJson,
  fileExists,
  ensureDir,
} from './sessionUtils.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'completed' | 'interrupted' | 'error';

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  model: string;
  provider: string;
  status: SessionStatus;
  version: number;
}

export interface SessionRecord {
  id: string;
  title: string;
  messages: AgentMessage[];
  meta: SessionMeta;
}

interface SessionDocument {
  version: number;
  meta: SessionMeta;
  messages: AgentMessage[];
}

interface SaveSessionOptions {
  status?: SessionStatus;
  model?: string;
  provider?: string;
  title?: string;
}

// ─── Migration System ──────────────────────────────────────────────────────────

interface Migration {
  from: number;
  to: number;
  up: (doc: SessionDocument) => SessionDocument;
}

const MIGRATIONS: Migration[] = [
  {
    from: 0,
    to: 1,
    up: (doc) => {
      // Version 0 → 1: Initial schema. Just ensure all fields present.
      return {
        ...doc,
        version: 1,
        meta: {
          ...doc.meta,
          version: 1,
          status: doc.meta.status || 'completed',
          model: doc.meta.model || 'unknown',
          provider: doc.meta.provider || 'unknown',
          messageCount: doc.meta.messageCount ?? doc.messages?.length ?? 0,
        },
      };
    },
  },
  // Future migrations go here:
  // {
  //   from: 1,
  //   to: 2,
  //   up: (doc) => { ... },
  // },
];

function runMigrations(doc: SessionDocument): SessionDocument {
  let current = doc;
  for (const migration of MIGRATIONS) {
    if (current.version < migration.to) {
      current = migration.up(current);
    }
  }
  return current;
}

// ─── Repository Interface ───────────────────────────────────────────────────────

export interface ISessionRepository {
  save(id: string, messages: AgentMessage[], options?: SaveSessionOptions): Promise<void>;
  load(id: string): Promise<SessionRecord | null>;
  list(limit?: number): Promise<SessionMeta[]>;
  delete(id: string): Promise<void>;
  latestId(): Promise<string | null>;
}

// ─── JSON Implementation ────────────────────────────────────────────────────────

export class JsonSessionRepository implements ISessionRepository {
  constructor() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    void this.cleanupTempFiles();
  }

  async save(id: string, messages: AgentMessage[], options: SaveSessionOptions = {}): Promise<void> {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
      await this.cleanupTempFiles();
      const filePath = this.getPath(id);
      if (!filePath) {
        console.error(`[JsonSessionRepository] Invalid session ID: ${id}`);
        return;
      }
      const title = options.title || this.extractTitle(messages) || 'New Session';
      const updatedAt = Date.now();
      const document: SessionDocument = {
        version: SESSION_VERSION,
        meta: {
          id,
          title,
          updatedAt,
          messageCount: messages.length,
          model: options.model || 'unknown',
          provider: options.provider || 'unknown',
          status: options.status || 'completed',
          version: SESSION_VERSION,
        },
        messages,
      };

      await this.atomicWriteJson(filePath, document);
    } catch (err) {
      console.error(`[JsonSessionRepository] Failed to save session "${id}":`, err);
    }
  }

  async load(id: string): Promise<SessionRecord | null> {
    const filePath = this.getPath(id);
    if (!filePath || !(await this.exists(filePath))) return null;

    try {
      const raw = await fsp.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SessionDocument;
      const migrated = runMigrations(parsed);
      return this.normalize(migrated);
    } catch (err) {
      console.error('[JsonSessionRepository] Failed to load session:', err);
      return null;
    }
  }

  async list(limit: number = 50): Promise<SessionMeta[]> {
    if (!(await this.exists(SESSIONS_DIR))) return [];

    const entries = await fsp.readdir(SESSIONS_DIR, { withFileTypes: true });
    const jsonEntries = entries
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name);

    // Batch-stat all files in parallel — eliminates N blocking statSync calls
    const entriesWithStat = await Promise.all(
      jsonEntries.map(async (entry) => {
        const stat = await fsp.stat(path.join(SESSIONS_DIR, entry));
        return { entry, mtimeMs: stat.mtimeMs ?? 0 };
      })
    );

    entriesWithStat.sort((a, b) => b.mtimeMs - a.mtimeMs);

    // Apply limit to avoid unbounded O(n) file reads when limit is not specified.
    // Default limit of 50 balances completeness with performance for session lists.
    const entriesToRead = entriesWithStat.slice(0, limit);

    if (entriesToRead.length === 0) return [];

    const sessions = await Promise.all(
      entriesToRead.map(async ({ entry }) => {
        try {
          const raw = await fsp.readFile(path.join(SESSIONS_DIR, entry), 'utf-8');
          const parsed = JSON.parse(raw) as SessionDocument;
          const migrated = runMigrations(parsed);
          const record = this.normalize(migrated);
          return record?.meta || null;
        } catch (err) {
          console.error('[JsonSessionRepository] Failed to read session file:', err);
          return null;
        }
      })
    );

    return sessions.filter((s): s is SessionMeta => s !== null);
  }

  async delete(id: string): Promise<void> {
    const filePath = this.getPath(id);
    if (!filePath) return;
    try {
      await fsp.rm(filePath, { force: true });
    } catch (err) {
      console.error(`[JsonSessionRepository] Failed to delete session "${id}":`, err);
    }
  }

  async latestId(): Promise<string | null> {
    const history = await this.list(1);
    return history[0]?.id ?? null;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private getPath(id: string): string | null {
    if (!isValidSessionId(id)) return null;
    return path.join(SESSIONS_DIR, `${id}.json`);
  }

  protected async atomicWriteJson(filePath: string, data: unknown): Promise<void> {
    const payload = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp`;
    let handle: fsp.FileHandle | null = null;
    let renamed = false;

    try {
      await this.removeFileWithRetry(tmpPath);
      handle = await fsp.open(tmpPath, 'w');
      await handle.writeFile(payload, 'utf-8');
      await handle.close();
      handle = null;

      try {
        await fsp.rename(tmpPath, filePath);
        renamed = true;
      } catch (err) {
        console.error('[JsonSessionRepository] atomicWriteJson rename error:', err);
        await fsp.rm(filePath, { force: true });
        await fsp.rename(tmpPath, filePath);
        renamed = true;
      }
    } finally {
      if (handle) {
        await handle.close().catch((err) => console.error('Failed to close handle:', err));
      }
      if (!renamed) {
        await this.removeFileWithRetry(tmpPath);
      }
    }
  }

  protected async removeFileWithRetry(target: string): Promise<void> {
    const delays = [50, 100, 200];
    for (let i = 0; i < 3; i++) {
      try {
        await fsp.rm(target, { force: true });
        return;
      } catch {
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }
    }
  }

  protected async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fsp.readdir(SESSIONS_DIR);
      const tmpFiles = files.filter(file => file.endsWith('.tmp'));
      await Promise.all(tmpFiles.map(file => fsp.rm(path.join(SESSIONS_DIR, file), { force: true })));
    } catch {
      // Ignore cleanup failures
    }
  }

  protected normalize(doc: SessionDocument): SessionRecord | null {
    if (!doc || typeof doc !== 'object') return null;
    if (!doc.meta || !Array.isArray(doc.messages)) return null;

    const meta = doc.meta;
    if (!meta.id || !meta.title || !meta.updatedAt) return null;

    return {
      id: meta.id,
      title: meta.title || 'New Session',
      messages: doc.messages,
      meta: {
        id: meta.id,
        title: meta.title || 'New Session',
        updatedAt: meta.updatedAt,
        messageCount: typeof meta.messageCount === 'number' ? meta.messageCount : doc.messages.length,
        model: meta.model || 'unknown',
        provider: meta.provider || 'unknown',
        status: meta.status || 'completed',
        version: meta.version || SESSION_VERSION,
      },
    };
  }

  protected extractTitle(messages: AgentMessage[]): string | null {
    if (messages.length === 0) return null;
    const firstUserMsg = messages.find(m => m.role === 'user');
    const content = this.extractMessageText((firstUserMsg as any)?.content);
    if (!content) return null;
    const text = content.trim();
    return text.length > 40 ? text.slice(0, 40) + '...' : text;
  }

  private extractMessageText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts = content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          if (item && typeof item.content === 'string') return item.content;
          if (item && typeof item.input_text === 'string') return item.input_text;
          return '';
        })
        .filter(Boolean);
      return parts.join(' ');
    }
    if (content && typeof content === 'object') {
      const obj = content as any;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.input_text === 'string') return obj.input_text;
    }
    return '';
  }

  private async exists(target: string): Promise<boolean> {
    try {
      await fsp.access(target);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

const _repo = new JsonSessionRepository();

/**
 * LegacySessionManager — wraps JsonSessionRepository with the old SessionManager interface
 * (getHistory/saveSession/loadSession) so that existing consumers don't break.
 */
class LegacySessionManager extends JsonSessionRepository {
  getHistory(limit?: number): Promise<SessionMeta[]> {
    return this.list(limit);
  }

  saveSession(
    id: string,
    messages: Parameters<JsonSessionRepository['save']>[1],
    options?: Parameters<JsonSessionRepository['save']>[2]
  ): Promise<void> {
    return this.save(id, messages, options);
  }

  loadSession(id: string): Promise<SessionRecord | null> {
    return this.load(id);
  }
}

export const sessionRepository: LegacySessionManager = new LegacySessionManager();
