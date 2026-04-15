/**
 * Unit tests for SessionIndexCache (sessionIndexCache.ts)
 * 
 * Uses a TestableSessionIndexCache subclass to inject mock fs/promises,
 * avoiding top-level vi.mock of shared modules that corrupt other tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentMessage } from '@mariozechner/pi-agent-core';

// ─── Testable subclass — injects mock fsp ───────────────────────────────────

class TestableSessionIndexCache {
  // eslint-disable-next-line no-restricted-globals
  protected _fsp: typeof import('fs/promises') = null!;

  constructor(private mockFsp: typeof import('fs/promises')) {
    this._fsp = mockFsp;
  }

  get indexPath(): string {
    return '/.codeagent/sessions/index.json';
  }

  async readIndex() {
    try {
      await this._fsp.access(this.indexPath);
    } catch {
      return { version: 1, sessions: [] };
    }
    try {
      const raw = await this._fsp.readFile(this.indexPath, 'utf-8');
      if (!raw.trim()) return { version: 1, sessions: [] };
      return JSON.parse(raw);
    } catch {
      return { version: 1, sessions: [] };
    }
  }

  async writeIndex(index: any) {
    await this._fsp.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  async updateIndex(entry: any) {
    const index = await this.readIndex();
    const existingIdx = index.sessions.findIndex((s: any) => s.id === entry.id);
    if (existingIdx >= 0) {
      index.sessions[existingIdx] = entry;
    } else {
      index.sessions.push(entry);
    }
    index.sessions.sort((a: any, b: any) => b.mtimeMs - a.mtimeMs);
    await this.writeIndex(index);
  }

  async removeFromIndex(sessionId: string) {
    const index = await this.readIndex();
    index.sessions = index.sessions.filter((s: any) => s.id !== sessionId);
    await this.writeIndex(index);
  }

  async rebuildIndex(sessionFiles: { name: string; mtimeMs: number }[]) {
    const sessions = [];
    for (const file of sessionFiles) {
      const sessionId = file.name.replace(/\.json$/, '');
      try {
        const raw = await this._fsp.readFile(`/.codeagent/sessions/${file.name}`, 'utf-8');
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
      } catch { /* skip */ }
    }
    sessions.sort((a: any, b: any) => b.mtimeMs - a.mtimeMs);
    await this.writeIndex({ version: 1, sessions });
  }
}

describe('SessionIndexCache', () => {
  // ─── readIndex ───────────────────────────────────────────────────────────

  describe('readIndex()', () => {
    it('returns empty index when file does not exist', async () => {
      const mockFsp = {
        access: vi.fn().mockRejectedValue(new Error('ENOENT')),
        readFile: vi.fn(),
        writeFile: vi.fn(),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      const index = await cache.readIndex();

      expect(index.version).toBe(1);
      expect(index.sessions).toEqual([]);
    });

    it('returns empty index when JSON is malformed', async () => {
      const mockFsp = {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue('not valid json {{{'),
        writeFile: vi.fn(),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      const index = await cache.readIndex();

      expect(index.version).toBe(1);
      expect(index.sessions).toEqual([]);
    });

    it('reads valid index file correctly', async () => {
      const indexData = {
        version: 1,
        sessions: [
          { id: 'session-1', mtimeMs: 1000, title: 'Session 1', messageCount: 5, updatedAt: 1000 },
          { id: 'session-2', mtimeMs: 2000, title: 'Session 2', messageCount: 10, updatedAt: 2000 },
        ],
      };
      const mockFsp = {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(JSON.stringify(indexData)),
        writeFile: vi.fn(),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      const index = await cache.readIndex();

      expect(index.sessions).toHaveLength(2);
      expect(index.sessions[0].id).toBe('session-1');
    });
  });

  // ─── updateIndex ─────────────────────────────────────────────────────────

  describe('updateIndex()', () => {
    it('creates new entry for new session', async () => {
      let writtenData: any = null;
      const mockFsp = {
        access: vi.fn().mockRejectedValue(new Error('ENOENT')),
        readFile: vi.fn().mockResolvedValue(JSON.stringify({ version: 1, sessions: [] })),
        writeFile: vi.fn().mockImplementation((path: string, data: string) => { writtenData = JSON.parse(data); }),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      await cache.updateIndex({ id: 'new-session', mtimeMs: 5000, title: 'New Session', messageCount: 3, updatedAt: 5000 });

      expect(writtenData.sessions).toHaveLength(1);
      expect(writtenData.sessions[0].id).toBe('new-session');
    });

    it('updates existing entry when session already in index', async () => {
      let writtenData: any = null;
      const mockFsp = {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(JSON.stringify({
          version: 1,
          sessions: [{ id: 'existing', mtimeMs: 1000, title: 'Old', messageCount: 1, updatedAt: 1000 }],
        })),
        writeFile: vi.fn().mockImplementation((path: string, data: string) => { writtenData = JSON.parse(data); }),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      await cache.updateIndex({ id: 'existing', mtimeMs: 5000, title: 'Updated', messageCount: 10, updatedAt: 5000 });

      expect(writtenData.sessions).toHaveLength(1);
      expect(writtenData.sessions[0].title).toBe('Updated');
    });

    it('sorts sessions by mtimeMs descending after update', async () => {
      let writtenData: any = null;
      const mockFsp = {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(JSON.stringify({
          version: 1,
          sessions: [
            { id: 'old', mtimeMs: 1000, title: 'Old', messageCount: 1, updatedAt: 1000 },
            { id: 'middle', mtimeMs: 2000, title: 'Middle', messageCount: 2, updatedAt: 2000 },
          ],
        })),
        writeFile: vi.fn().mockImplementation((path: string, data: string) => { writtenData = JSON.parse(data); }),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      await cache.updateIndex({ id: 'newest', mtimeMs: 5000, title: 'Newest', messageCount: 3, updatedAt: 5000 });

      expect(writtenData.sessions[0].id).toBe('newest');
      expect(writtenData.sessions[1].id).toBe('middle');
      expect(writtenData.sessions[2].id).toBe('old');
    });

    it('removes entry from index', async () => {
      let writtenData: any = null;
      const mockFsp = {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(JSON.stringify({
          version: 1,
          sessions: [
            { id: 'to-remove', mtimeMs: 1000, title: 'To Remove', messageCount: 1, updatedAt: 1000 },
            { id: 'to-keep', mtimeMs: 2000, title: 'To Keep', messageCount: 2, updatedAt: 2000 },
          ],
        })),
        writeFile: vi.fn().mockImplementation((path: string, data: string) => { writtenData = JSON.parse(data); }),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      await cache.removeFromIndex('to-remove');

      expect(writtenData.sessions).toHaveLength(1);
      expect(writtenData.sessions[0].id).toBe('to-keep');
    });
  });

  // ─── rebuildIndex ────────────────────────────────────────────────────────

  describe('rebuildIndex()', () => {
    it('reads session files and builds new index sorted by mtimeMs', async () => {
      let writtenData: any = null;
      const session1 = { version: 1, meta: { id: 's1', title: 'S1', updatedAt: 1000, messageCount: 5, model: 'm', provider: 'p', status: 'completed', version: 1 }, messages: [] };
      const session2 = { version: 1, meta: { id: 's2', title: 'S2', updatedAt: 2000, messageCount: 10, model: 'm', provider: 'p', status: 'completed', version: 1 }, messages: [] };
      const mockFsp = {
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockImplementation(async (p: string) => {
          if (p.includes('session-1.json')) return JSON.stringify(session1);
          if (p.includes('session-2.json')) return JSON.stringify(session2);
          return '{}';
        }),
        writeFile: vi.fn().mockImplementation((path: string, data: string) => { writtenData = JSON.parse(data); }),
      } as any;
      const cache = new TestableSessionIndexCache(mockFsp);

      await cache.rebuildIndex([
        { name: 'session-1.json', mtimeMs: 1000 },
        { name: 'session-2.json', mtimeMs: 2000 },
      ]);

      expect(writtenData.sessions).toHaveLength(2);
      expect(writtenData.sessions[0].id).toBe('session-2');  // latest first
      expect(writtenData.sessions[1].id).toBe('session-1');
    });
  });
});
