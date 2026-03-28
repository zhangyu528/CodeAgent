import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { AgentMessage } from '@mariozechner/pi-agent-core';

const CONFIG_DIR = path.join(os.homedir(), '.codeagent');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');
const SESSION_VERSION = 1;

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
    } catch {
      // Ignore cleanup failures to avoid impacting CLI startup.
    }
  }
  async saveSession(id: string, messages: AgentMessage[], options: SaveSessionOptions = {}): Promise<void> {
    // Ensure sessions directory exists before writing
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    await this.cleanupTempFiles();
    const filePath = this.getSessionPath(id);
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
  }

  async loadSession(id: string): Promise<SessionRecord | null> {
    const filePath = this.getSessionPath(id);
    if (!(await this.exists(filePath))) return null;

    try {
      const raw = await fsp.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return this.normalizeSessionRecord(id, parsed);
    } catch {
      return null;
    }
  }

  async getHistory(limit?: number): Promise<SessionInfo[]> {
    if (!(await this.exists(SESSIONS_DIR))) return [];

    const files = await fsp.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const sessions = await Promise.all(
      jsonFiles.map(async f => {
        try {
          const raw = await fsp.readFile(path.join(SESSIONS_DIR, f), 'utf-8');
          const parsed = JSON.parse(raw);
          const record = this.normalizeSessionRecord(path.basename(f, '.json'), parsed);
          return record?.meta || null;
        } catch {
          return null;
        }
      })
    );

    const sorted = sessions
      .filter((s): s is SessionInfo => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }

  async getLatestSessionId(): Promise<string | null> {
    const history = await this.getHistory(1);
    const latest = history[0];
    return latest ? latest.id : null;
  }

  private getSessionPath(id: string): string {
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
      } catch {
        await fsp.rm(filePath, { force: true });
        await fsp.rename(tmpPath, filePath);
        renamed = true;
      }
    } finally {
      if (handle) {
        await handle.close().catch(() => {});
      }
      if (!renamed) {
        await this.removeFileWithRetry(tmpPath);
      }
    }
  }

  private async removeFileWithRetry(target: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try {
        await fsp.rm(target, { force: true });
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 10 * (i + 1)));
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
    } catch {
      return false;
    }
  }
}

export const sessionManager = new SessionManager();

