import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { AgentMessage } from '@mariozechner/pi-agent-core';
import { CONFIG_DIR, SESSIONS_DIR, SESSION_VERSION, MAX_MESSAGES } from './constants.js';

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

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && typeof item.content === 'string') return item.content;
        if (item && typeof item.input_text === 'string') return item.input_text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (content && typeof content === 'object') {
    const obj = content as any;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.input_text === 'string') return obj.input_text;
  }
  return '';
}

// ─── Session Window ────────────────────────────────────────────────────────────

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

// Session ID must be alphanumeric, hyphen, or underscore — rejects path traversal
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function isValidSessionId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 255) return false;
  return SESSION_ID_REGEX.test(id);
}

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

export interface SessionInfo extends SessionMeta {}

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
      console.error('[SessionManager] cleanupTempFiles error:', err);
    }
  }
  async saveSession(id: string, messages: AgentMessage[], options: SaveSessionOptions = {}): Promise<void> {
    try {
      // Ensure sessions directory exists before writing
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
      await this.cleanupTempFiles();
      const filePath = this.getSessionPath(id);
      if (!filePath) {
        console.error(`[SessionManager] Invalid session ID: ${id}`);
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
      return this.normalizeSessionRecord(id, parsed);
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
          const record = this.normalizeSessionRecord(path.basename(entry, '.json'), parsed);
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
        console.error('[SessionManager] atomicWriteJson rename error:', err);
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

  private normalizeSessionRecord(_fallbackId: string, parsed: any): SessionRecord | null {
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.meta && Array.isArray(parsed.messages)) {
      const meta = parsed.meta as SessionMeta;
      if (!meta.id || !meta.title || !meta.updatedAt) return null;
      const messages = parsed.messages as AgentMessage[];
      return {
        id: meta.id,
        title: meta.title || 'New Session',
        messages,
        meta: {
          id: meta.id,
          title: meta.title || 'New Session',
          updatedAt: meta.updatedAt,
          messageCount: typeof meta.messageCount === 'number' ? meta.messageCount : messages.length,
          model: meta.model || 'unknown',
          provider: meta.provider || 'unknown',
          status: meta.status || 'completed',
          version: meta.version || SESSION_VERSION,
        },
      };
    }

    return null;
  }

  private extractTitle(messages: AgentMessage[]): string | null {
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
    } catch (err) {
      console.error('[SessionManager] exists check error:', err);
      return false;
    }
  }
}

export const sessionManager = new SessionManager();

