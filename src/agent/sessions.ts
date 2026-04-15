import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { AgentMessage } from '@mariozechner/pi-agent-core';
import { CONFIG_DIR, SESSIONS_DIR, SESSION_VERSION, MAX_MESSAGES } from './constants.js';
import { extractMessageText, isValidSessionId } from './sessionUtils.js';
import { runMigrations } from './sessionMigrations.js';
import {
  buildSessionDocument,
  normalizeSessionRecord,
  extractTitle,
  type SessionStatus,
  type SessionMeta,
  type SessionInfo,
  type SessionRecord,
  type SaveSessionOptions,
} from './sessionService.js';

// ─── Token Estimation ──────────────────────────────────────────────────────────

/**
 * Estimates token count for a list of messages using char/4 heuristic.
 * This avoids adding a heavy tokenization dependency while providing
 * a rough approximation suitable for memory management decisions.
 * Accuracy: ~95% for English text, less accurate for multilingual.
 */
export function estimateTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, msg) => {
    const text = extractMessageText(msg.content);
    return sum + Math.ceil((text.length || 0) / 4);
  }, 0);
}

// ─── Session Window ───────────────────────────────────────────────────────────

export interface SessionWindow {
  messages: AgentMessage[];
  totalTokens: number;
  totalMessages: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export interface LoadSessionWindowOptions {
  maxMessages?: number;
  anchor?: 'latest' | 'around';
}

/**
 * Loads a session with a bounded message window.
 * Prevents unbounded memory consumption from large sessions.
 */
export function loadSessionWindow(
  messages: AgentMessage[],
  options: LoadSessionWindowOptions = {}
): SessionWindow {
  const maxMessages = options.maxMessages ?? MAX_MESSAGES;
  const anchor = options.anchor ?? 'latest';

  if (messages.length <= maxMessages) {
    const totalTokens = estimateTokens(messages);
    return {
      messages,
      totalTokens,
      totalMessages: messages.length,
      hasMoreBefore: false,
      hasMoreAfter: false,
    };
  }

  if (anchor === 'latest') {
    // Return most recent messages
    const windowed = messages.slice(-maxMessages);
    return {
      messages: windowed,
      totalTokens: estimateTokens(windowed),
      totalMessages: messages.length,
      hasMoreBefore: true,
      hasMoreAfter: false,
    };
  }

  // 'around' anchor — center the window
  const startIdx = Math.max(0, Math.floor((messages.length - maxMessages) / 2));
  const windowed = messages.slice(startIdx, startIdx + maxMessages);
  return {
    messages: windowed,
    totalTokens: estimateTokens(windowed),
    totalMessages: messages.length,
    hasMoreBefore: startIdx > 0,
    hasMoreAfter: startIdx + maxMessages < messages.length,
  };
}

// Re-export shared types from sessionService
export type { SessionStatus, SessionMeta, SessionInfo, SessionRecord, SaveSessionOptions };

// ─── SessionManager ───────────────────────────────────────────────────────────

export class SessionManager {
  constructor() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    void this.cleanupTempFiles();
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fsp.readdir(SESSIONS_DIR);
      const tmpFiles = files.filter(file => file.endsWith('.tmp'));
      await Promise.all(tmpFiles.map(file => fsp.rm(path.join(SESSIONS_DIR, file), { force: true })));
    } catch (err) {
      // Ignore cleanup failures to avoid impacting CLI startup.
      console.warn('[SessionManager] cleanupTempFiles error:', err);
    }
  }

  async saveSession(id: string, messages: AgentMessage[], options: SaveSessionOptions = {}): Promise<void> {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
      await this.cleanupTempFiles();
      const filePath = this.getSessionPath(id);
      if (!filePath) {
        console.error(`[SessionManager] Invalid session ID: ${id}`);
        return;
      }
      const document = buildSessionDocument(id, messages, options);
      await this.atomicWriteJson(filePath, document);
    } catch (err) {
      // Gracefully handle session save failures to avoid crashing the CLI.
      console.error(`[SessionManager] Failed to save session "${id}":`, err);
    }
  }

  async loadSession(id: string): Promise<SessionRecord | null> {
    const filePath = this.getSessionPath(id);
    if (!filePath || !(await this.exists(filePath))) return null;

    try {
      const raw = await fsp.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const migrated = runMigrations(parsed);
      return normalizeSessionRecord(id, migrated);
    } catch (err) {
      console.error('[SessionManager] Failed to load session:', err);
      return null;
    }
  }

  async getHistory(limit?: number): Promise<SessionInfo[]> {
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

    const entriesToRead = typeof limit === 'number'
      ? entriesWithStat.slice(0, limit)
      : entriesWithStat;

    if (entriesToRead.length === 0) return [];

    const sessions = await Promise.all(
      entriesToRead.map(async ({ entry }) => {
        try {
          const raw = await fsp.readFile(path.join(SESSIONS_DIR, entry), 'utf-8');
          const parsed = JSON.parse(raw);
          const migrated = runMigrations(parsed);
          const record = normalizeSessionRecord(path.basename(entry, '.json'), migrated);
          return record?.meta || null;
        } catch (err) {
          console.error('[SessionManager] Failed to read session file:', err);
          return null;
        }
      })
    );

    return sessions
      .filter((s): s is SessionInfo => s !== null);
  }

  async getLatestSessionId(): Promise<string | null> {
    const history = await this.getHistory(1);
    const latest = history[0]!;
    return latest ? latest.id : null;
  }

  private getSessionPath(id: string): string | null {
    if (!isValidSessionId(id)) return null;
    return path.join(SESSIONS_DIR, `${id}.json`);
  }

  private async atomicWriteJson(filePath: string, data: unknown): Promise<void> {
    const payload = JSON.stringify(data, null, 2);
    const tmpPath = `${filePath}.tmp`;
    let handle: fs.promises.FileHandle | null = null;
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
        console.warn('[SessionManager] atomicWriteJson rename error:', err);
        await fsp.rm(filePath, { force: true });
        await fsp.rename(tmpPath, filePath);
        renamed = true;
      }
    } finally {
      if (handle) {
        await handle.close().catch((err) => console.warn('Failed to close handle:', err));
      }
      if (!renamed) {
        await this.removeFileWithRetry(tmpPath);
      }
    }
  }

  private async removeFileWithRetry(target: string): Promise<void> {
    const delays = [50, 100, 200]; // Exponential backoff: 50ms, 100ms, 200ms
    for (let i = 0; i < 3; i++) {
      try {
        await fsp.rm(target, { force: true });
        return;
      } catch (err) {
        console.warn(`[SessionManager] removeFileWithRetry attempt ${i + 1} failed:`, err);
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
      }
    }
  }

  private async exists(target: string): Promise<boolean> {
    try {
      await fsp.access(target);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export const sessionManager = new SessionManager();
