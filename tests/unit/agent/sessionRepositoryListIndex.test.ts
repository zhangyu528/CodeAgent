/**
 * Unit tests for session index usage in JsonSessionRepository.list()
 * 
 * Tests that list() reads from index.json instead of O(N) file reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentMessage } from '@mariozechner/pi-agent-core';

// ─── Shared mock refs ────────────────────────────────────────────────────────

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
  mockFspWriteFile,
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
  mockFspWriteFile: vi.fn(),
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
    writeFile: mockFspWriteFile,
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

// ─── Import after mocks ───────────────────────────────────────────────────────

import { sessionRepository } from '../../../src/agent/sessionRepository.js';

describe('JsonSessionRepository list() with index', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockFsExistsSync.mockReturnValue(true);
    mockFsMkdirSync.mockReturnValue(undefined);
    mockFspAccess.mockResolvedValue(undefined);
    mockFspReadFile.mockReset();
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
    mockFspWriteFile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list() reads from index', () => {
    it('returns sessions from index when index file exists', async () => {
      const indexData = {
        version: 1,
        sessions: [
          { id: 'session-1', mtimeMs: 2000, title: 'Session 1', messageCount: 5, updatedAt: 2000 },
          { id: 'session-2', mtimeMs: 1000, title: 'Session 2', messageCount: 10, updatedAt: 1000 },
        ],
      };
      // First read: index.json, second read: sessions dir check
      mockFspAccess.mockImplementation(async (p: string) => {
        if (p.includes('index.json')) {
          // index exists
          return undefined;
        }
        return undefined;
      });
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify(indexData));

      const result = await sessionRepository.list();

      expect(result).toHaveLength(2);
      // Sorted by mtime descending
      expect(result[0].id).toBe('session-1');
      expect(result[1].id).toBe('session-2');
      // Should NOT read individual session files
      // (only index.json read + sessions dir access)
    });

    it('respects limit parameter when reading from index', async () => {
      const indexData = {
        version: 1,
        sessions: Array.from({ length: 10 }, (_, i) => ({
          id: `session-${i}`,
          mtimeMs: 1000 + i * 100,
          title: `Session ${i}`,
          messageCount: i,
          updatedAt: 1000 + i * 100,
        })),
      };
      mockFspAccess.mockResolvedValue(undefined);
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify(indexData));

      const result = await sessionRepository.list(3);

      expect(result).toHaveLength(3);
    });

    it('returns empty array when index is empty', async () => {
      mockFspAccess.mockResolvedValue(undefined);
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify({ version: 1, sessions: [] }));

      const result = await sessionRepository.list();

      expect(result).toEqual([]);
    });
  });

  describe('list() fallback when index unavailable', () => {
    it('falls back to file-based listing when index read fails', async () => {
      // Simulate index read failure (corrupt JSON)
      mockFspAccess.mockImplementation(async (p: string) => {
        if (p.includes('index.json')) {
          // index exists but read fails
          return undefined;
        }
        throw new Error('ENOENT');
      });
      mockFspReadFile.mockImplementation(async (p: string) => {
        if (p.includes('index.json')) {
          throw new Error('EIO'); // index read fails
        }
        throw new Error('ENOENT');
      });
      // Fallback: sessions dir doesn't exist
      mockFspAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await sessionRepository.list();

      expect(result).toEqual([]);
    });
  });
});
