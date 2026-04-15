/**
 * SessionIndexCache — Index file management for fast session listing
 * 
 * Maintains sessions/index.json with session metadata (id, mtime, title, messageCount)
 * to avoid O(N) file stat calls when listing sessions.
 */

import fsp from 'fs/promises';
import path from 'path';
import { SESSIONS_DIR } from './constants.js';

export const INDEX_VERSION = 1;

export interface SessionIndexEntry {
  id: string;
  mtimeMs: number;
  title: string;
  messageCount: number;
  updatedAt: number;
}

export interface SessionIndex {
  version: number;
  sessions: SessionIndexEntry[];
}

export class SessionIndexCache {
  // For testing: allow injected fs/promises (helps mock isolation)
  // eslint-disable-next-line no-restricted-globals
  protected _fsp = fsp;

  get indexPath(): string {
    return path.join(SESSIONS_DIR, 'index.json');
  }

  async readIndex(): Promise<SessionIndex> {
    try {
      await this._fsp.access(this.indexPath);
    } catch {
      // Index doesn't exist — return empty index
      return { version: INDEX_VERSION, sessions: [] };
    }

    try {
      const raw = await this._fsp.readFile(this.indexPath, 'utf-8');
      if (!raw.trim()) {
        return { version: INDEX_VERSION, sessions: [] };
      }
      const parsed = JSON.parse(raw) as SessionIndex;
      // Defensive: ensure sessions is always an array
      if (!Array.isArray(parsed.sessions)) {
        return { version: INDEX_VERSION, sessions: [] };
      }
      return parsed;
    } catch {
      // Corrupted index — return empty index
      return { version: INDEX_VERSION, sessions: [] };
    }
  }

  async writeIndex(index: SessionIndex): Promise<void> {
    const payload = JSON.stringify(index, null, 2);
    await this._fsp.writeFile(this.indexPath, payload, 'utf-8');
  }

  async updateIndex(entry: SessionIndexEntry): Promise<void> {
    const index = await this.readIndex();

    // Update or insert entry
    const existingIdx = index.sessions.findIndex(s => s.id === entry.id);
    if (existingIdx >= 0) {
      index.sessions[existingIdx] = entry;
    } else {
      index.sessions.push(entry);
    }

    // Sort by mtime descending
    index.sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);

    await this.writeIndex(index);
  }

  async removeFromIndex(sessionId: string): Promise<void> {
    const index = await this.readIndex();
    index.sessions = index.sessions.filter(s => s.id !== sessionId);
    await this.writeIndex(index);
  }

  async rebuildIndex(sessionFiles: { name: string; mtimeMs: number }[]): Promise<void> {
    const sessions: SessionIndexEntry[] = [];

    for (const file of sessionFiles) {
      const sessionId = file.name.replace(/\.json$/, '');
      try {
        const raw = await this._fsp.readFile(path.join(SESSIONS_DIR, file.name), 'utf-8');
        const doc = JSON.parse(raw);
        if (doc?.meta) {
          sessions.push({
            id: sessionId,
            mtimeMs: file.mtimeMs,
            title: doc.meta.title || 'Untitled',
            messageCount: doc.meta.messageCount ?? 0,
            updatedAt: doc.meta.updatedAt || file.mtimeMs,
          });
        }
      } catch {
        // Skip corrupt session files
      }
    }

    // Sort by mtime descending
    sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);

    await this.writeIndex({ version: INDEX_VERSION, sessions });
  }
}
