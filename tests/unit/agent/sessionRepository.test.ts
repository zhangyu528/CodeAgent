/**
 * Unit tests for JsonSessionRepository (sessionRepository.ts)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn().mockReturnValue(undefined),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn().mockReturnValue(undefined),
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    rename: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ mtimeMs: 1000 }),
    open: vi.fn().mockResolvedValue({
      writeFile: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  rmdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  rename: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ mtimeMs: 1000 }),
  open: vi.fn().mockResolvedValue({
    writeFile: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args: string[]) => '/' + args.slice(1).join('/').replace(/^\/+/, '')),
    resolve: vi.fn((...args: string[]) => '/' + args.filter(Boolean).join('/').replace(/^\/+/, '')),
    dirname: vi.fn((f: string) => '/' + f.split('/').slice(0, -1).join('/').replace(/^\/+/, '')),
    sep: '/',
  },
  join: vi.fn((...args: string[]) => '/' + args.slice(1).join('/').replace(/^\/+/, '')),
  resolve: vi.fn((...args: string[]) => '/' + args.filter(Boolean).join('/').replace(/^\/+/, '')),
  dirname: vi.fn((f: string) => '/' + f.split('/').slice(0, -1).join('/').replace(/^\/+/, '')),
  sep: '/',
}));

vi.mock('os', () => ({
  default: { homedir: vi.fn(() => '/home/testuser') },
  homedir: vi.fn(() => '/home/testuser'),
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────────
import { sessionRepository } from '../../../src/agent/sessionRepository.js';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

describe('JsonSessionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: sessions dir exists
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fsp.access).mockResolvedValue(undefined);
    vi.mocked(fsp.readFile).mockResolvedValue('{}');
    vi.mocked(fsp.readdir).mockResolvedValue([]);
    vi.mocked(fsp.stat).mockResolvedValue({ mtimeMs: Date.now() } as any);
    vi.mocked(fsp.rm).mockResolvedValue(undefined);
    vi.mocked(fsp.rename).mockResolvedValue(undefined);
    vi.mocked(fsp.open).mockResolvedValue({
      writeFile: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── session ID validation ───────────────────────────────────────────────

  describe('session ID validation', () => {
    it('accepts valid alphanumeric IDs', async () => {
      vi.mocked(fsp.access).mockRejectedValueOnce(new Error('ENOENT'));
      const result = await sessionRepository.load('valid-session123');
      expect(result).toBeNull();
    });

    it('rejects path traversal attempt', async () => {
      const result = await sessionRepository.load('../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('rejects empty ID', async () => {
      const result = await sessionRepository.load('');
      expect(result).toBeNull();
    });

    it('rejects IDs over 255 chars', async () => {
      const result = await sessionRepository.load('a'.repeat(256));
      expect(result).toBeNull();
    });
  });

  // ─── save ───────────────────────────────────────────────────────────────

  describe('save', () => {
    it('writes session JSON atomically', async () => {
      vi.mocked(fsp.readdir).mockResolvedValue([]);
      await sessionRepository.save('my-session', []);
      expect(vi.mocked(fsp.open)).toHaveBeenCalled();
      expect(vi.mocked(fsp.rename)).toHaveBeenCalled();
    });
  });

  // ─── load ───────────────────────────────────────────────────────────────

  describe('load', () => {
    it('loads a valid session record', async () => {
      const doc = {
        version: 1,
        meta: {
          id: 'test-session', title: 'Test', updatedAt: Date.now(),
          messageCount: 1, model: 'glm-4', provider: 'zai',
          status: 'completed', version: 1,
        },
        messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }],
      };
      vi.mocked(fsp.readFile).mockResolvedValueOnce(JSON.stringify(doc));

      const result = await sessionRepository.load('test-session');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-session');
      expect(result!.meta.model).toBe('glm-4');
    });

    it('returns null for non-existent session', async () => {
      vi.mocked(fsp.access).mockRejectedValueOnce(new Error('ENOENT'));
      const result = await sessionRepository.load('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
      vi.mocked(fsp.readFile).mockResolvedValueOnce('not json {{{');
      const result = await sessionRepository.load('bad-session');
      expect(result).toBeNull();
    });

    it('returns null for missing required meta fields', async () => {
      vi.mocked(fsp.readFile).mockResolvedValueOnce(JSON.stringify({
        version: 1,
        meta: { id: 'test' },
        messages: [],
      }));
      const result = await sessionRepository.load('incomplete-session');
      expect(result).toBeNull();
    });
  });

  // ─── list ───────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns empty array when sessions dir does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      const result = await sessionRepository.list();
      expect(result).toEqual([]);
    });

    it('sorts sessions by mtime descending', async () => {
      const now = Date.now();
      const s1 = {
        version: 1,
        meta: { id: 's1', title: 'A', updatedAt: now - 100, messageCount: 1, model: 'm', provider: 'p', status: 'completed', version: 1 },
        messages: [],
      };
      const s2 = {
        version: 1,
        meta: { id: 's2', title: 'B', updatedAt: now, messageCount: 2, model: 'm', provider: 'p', status: 'completed', version: 1 },
        messages: [],
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsp.readdir).mockResolvedValue([
        { isFile: () => true, isDirectory: () => false, name: 's1.json' } as any,
        { isFile: () => true, isDirectory: () => false, name: 's2.json' } as any,
      ]);
      vi.mocked(fsp.stat)
        .mockResolvedValueOnce({ mtimeMs: now - 100 } as any)
        .mockResolvedValueOnce({ mtimeMs: now } as any);
      vi.mocked(fsp.readFile)
        .mockResolvedValueOnce(JSON.stringify(s1))
        .mockResolvedValueOnce(JSON.stringify(s2));

      const result = await sessionRepository.list();
      expect(result[0].id).toBe('s2');
      expect(result[1].id).toBe('s1');
    });

    it('respects limit', async () => {
      const now = Date.now();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsp.readdir).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) =>
          ({ isFile: () => true, isDirectory: () => false, name: `s${i}.json` } as any)
        )
      );
      for (let i = 0; i < 5; i++) {
        vi.mocked(fsp.stat).mockResolvedValueOnce({ mtimeMs: now - i * 10 } as any);
        vi.mocked(fsp.readFile).mockResolvedValueOnce(JSON.stringify({
          version: 1,
          meta: { id: `s${i}`, title: `S${i}`, updatedAt: now - i * 10, messageCount: 1, model: 'm', provider: 'p', status: 'completed', version: 1 },
          messages: [],
        }));
      }

      const result = await sessionRepository.list(3);
      expect(result).toHaveLength(3);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes session file', async () => {
      await sessionRepository.delete('session-to-delete');
      expect(vi.mocked(fsp.rm)).toHaveBeenCalled();
    });

    it('silently handles non-existent session', async () => {
      vi.mocked(fsp.rm).mockRejectedValueOnce(new Error('ENOENT'));
      await expect(sessionRepository.delete('ghost')).resolves.not.toThrow();
    });
  });

  // ─── latestId ───────────────────────────────────────────────────────────

  describe('latestId', () => {
    it('returns most recent session ID', async () => {
      const now = Date.now();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsp.readdir).mockResolvedValue([
        { isFile: () => true, isDirectory: () => false, name: 'session-new.json' } as any,
      ]);
      vi.mocked(fsp.stat).mockResolvedValueOnce({ mtimeMs: now } as any);
      vi.mocked(fsp.readFile).mockResolvedValueOnce(JSON.stringify({
        version: 1,
        meta: { id: 'session-new', title: 'New', updatedAt: now, messageCount: 1, model: 'm', provider: 'p', status: 'completed', version: 1 },
        messages: [],
      }));

      const result = await sessionRepository.latestId();
      expect(result).toBe('session-new');
    });

    it('returns null when no sessions', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      const result = await sessionRepository.latestId();
      expect(result).toBeNull();
    });
  });
});
