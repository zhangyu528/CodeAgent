/**
 * Unit tests for JsonSessionRepository (sessionRepository.ts)
 *
 * Uses vi.hoisted() + vi.mock factory to share mock references between
 * the mock definition and the test body. Key insight: vi.mock() factories
 * run when the module is first imported (at module evaluation time), so
 * mock fns must be available at that point via vi.hoisted().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Shared mock refs — MUST use vi.hoisted() so vi.mock factories can access them ─

const {
  mockFsExistsSync,
  mockFsMkdirSync,
  mockFspAccess,
  mockFspReadFile,
  mockFspReaddir,
  mockFspStat,
  mockFspRm,
  mockFspRename,
  mockFspOpen,
} = vi.hoisted(() => ({
  mockFsExistsSync: vi.fn(),
  mockFsMkdirSync: vi.fn(),
  mockFspAccess: vi.fn(),
  mockFspReadFile: vi.fn(),
  mockFspReaddir: vi.fn(),
  mockFspStat: vi.fn(),
  mockFspRm: vi.fn(),
  mockFspRename: vi.fn(),
  mockFspOpen: vi.fn(),
}));

vi.mock('fs', () => {
  const mockFs = {
    existsSync: mockFsExistsSync,
    mkdirSync: mockFsMkdirSync,
  };
  return { default: mockFs, ...mockFs };
});

vi.mock('fs/promises', () => {
  const mockFsp = {
    access: mockFspAccess,
    readFile: mockFspReadFile,
    readdir: mockFspReaddir,
    stat: mockFspStat,
    rm: mockFspRm,
    rename: mockFspRename,
    open: mockFspOpen,
  };
  return { default: mockFsp, ...mockFsp };
});

vi.mock('path', () => {
  const mockPath = {
    join: vi.fn((...args: string[]) => '/' + args.slice(1).join('/').replace(/^\/+/, '')),
    resolve: vi.fn((...args: string[]) => '/' + args.filter(Boolean).join('/').replace(/^\/+/, '')),
    dirname: vi.fn((f: string) => '/' + f.split('/').slice(0, -1).join('/').replace(/^\/+/, '')),
    sep: '/',
  };
  return { default: mockPath, ...mockPath };
});

vi.mock('os', () => {
  const mockOs = { homedir: vi.fn(() => '/home/testuser') };
  return { default: mockOs, ...mockOs };
});

// ─── Import the singleton ────────────────────────────────────────────────────

import { sessionRepository } from '../../../src/agent/sessionRepository.js';

describe('JsonSessionRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Default "good" state — sessions dir exists, all ops succeed
    mockFsExistsSync.mockReturnValue(true);
    mockFsMkdirSync.mockReturnValue(undefined);
    mockFspAccess.mockResolvedValue(undefined);
    mockFspReadFile.mockResolvedValue('{}');
    // Reset mock implementations from previous tests
    // (vi.clearAllMocks() only resets call history, NOT implementations)
    mockFspReaddir.mockReset();
    mockFspReaddir.mockResolvedValue([]);
    mockFspStat.mockReset();
    mockFspStat.mockResolvedValue({ mtimeMs: Date.now() } as any);
    mockFspRm.mockResolvedValue(undefined);
    mockFspRename.mockResolvedValue(undefined);
    mockFspOpen.mockReset();
    mockFspOpen.mockResolvedValue({
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
      mockFspAccess.mockRejectedValueOnce(new Error('ENOENT'));
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
      mockFspReaddir.mockResolvedValue([]);
      await sessionRepository.save('my-session', []);
      expect(mockFspOpen).toHaveBeenCalled();
      expect(mockFspRename).toHaveBeenCalled();
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
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify(doc));

      const result = await sessionRepository.load('test-session');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-session');
      expect(result!.meta.model).toBe('glm-4');
    });

    it('returns null for non-existent session', async () => {
      mockFspAccess.mockRejectedValueOnce(new Error('ENOENT'));
      const result = await sessionRepository.load('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
      mockFspReadFile.mockResolvedValueOnce('not json {{{');
      const result = await sessionRepository.load('bad-session');
      expect(result).toBeNull();
    });

    it('returns null for missing required meta fields', async () => {
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify({
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
      mockFsExistsSync.mockReturnValueOnce(false);
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

      mockFsExistsSync.mockReturnValue(true);
      mockFspReaddir.mockResolvedValue([
        { isFile: () => true, isDirectory: () => false, name: 's1.json' } as any,
        { isFile: () => true, isDirectory: () => false, name: 's2.json' } as any,
      ]);
      // Use mockImplementation so return value depends on the actual path
      // (Promise.all resolves all stats simultaneously, so queue order is unreliable)
      mockFspStat.mockImplementation(
        async (p: string) => {
          if (p.includes('s1.json')) return { mtimeMs: now - 100 } as any;
          if (p.includes('s2.json')) return { mtimeMs: now } as any;
          return { mtimeMs: Date.now() } as any;
        }
      );
      mockFspReadFile
        .mockResolvedValueOnce(JSON.stringify(s1))
        .mockResolvedValueOnce(JSON.stringify(s2));

      const result = await sessionRepository.list();
      expect(result[0].id).toBe('s2');
      expect(result[1].id).toBe('s1');
    });

    it('respects limit', async () => {
      const now = Date.now();
      mockFsExistsSync.mockReturnValue(true);
      mockFspReaddir.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) =>
          ({ isFile: () => true, isDirectory: () => false, name: `s${i}.json` } as any)
        )
      );
      for (let i = 0; i < 5; i++) {
        mockFspStat.mockResolvedValueOnce({ mtimeMs: now - i * 10 } as any);
        mockFspReadFile.mockResolvedValueOnce(JSON.stringify({
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
      expect(mockFspRm).toHaveBeenCalled();
    });

    it('silently handles non-existent session', async () => {
      mockFspRm.mockRejectedValueOnce(new Error('ENOENT'));
      await expect(sessionRepository.delete('ghost')).resolves.not.toThrow();
    });
  });

  // ─── latestId ───────────────────────────────────────────────────────────

  describe('latestId', () => {
    it('returns most recent session ID', async () => {
      const now = Date.now();
      mockFsExistsSync.mockReturnValue(true);
      mockFspReaddir.mockResolvedValue([
        { isFile: () => true, isDirectory: () => false, name: 'session-new.json' } as any,
      ]);
      // Single session with mtime = now
      mockFspStat.mockImplementation(
        async (p: string) => ({ mtimeMs: now } as any)
      );
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify({
        version: 1,
        meta: { id: 'session-new', title: 'New', updatedAt: now, messageCount: 1, model: 'm', provider: 'p', status: 'completed', version: 1 },
        messages: [],
      }));

      const result = await sessionRepository.latestId();
      expect(result).toBe('session-new');
    });

    it('returns null when no sessions', async () => {
      mockFsExistsSync.mockReturnValueOnce(false);
      const result = await sessionRepository.latestId();
      expect(result).toBeNull();
    });
  });
});
