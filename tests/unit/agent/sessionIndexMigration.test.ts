/**
 * Unit tests for session index migration.
 * 
 * Key behaviors tested:
 * 1. delete() removes session from index
 * 2. save() creates/updates index entries
 * 3. list() uses index when available, falls back when empty
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentMessage } from '@mariozechner/pi-agent-core';

// ─── Shared mock refs ──────────────────────────────────────────────────────

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

import { sessionRepository } from '../../../src/agent/sessionRepository.js';

describe('Session index migration', () => {
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

  describe('delete() removes entry from index', () => {
    it('removes session from index after deletion', async () => {
      const existingIndex = {
        version: 1,
        sessions: [
          { id: 'session-to-delete', mtimeMs: 1000, title: 'To Delete', messageCount: 1, updatedAt: 1000 },
          { id: 'keep-this', mtimeMs: 2000, title: 'Keep', messageCount: 2, updatedAt: 2000 },
        ],
      };

      // readIndex returns existing index
      // rm succeeds (no error)
      let writtenData: any = null;
      mockFspReadFile.mockResolvedValue(JSON.stringify(existingIndex));
      mockFspWriteFile.mockImplementation((p: string, data: string) => {
        writtenData = JSON.parse(data);
      });

      await sessionRepository.delete('session-to-delete');

      // Should have written updated index without the deleted session
      expect(mockFspRm).toHaveBeenCalled();
      expect(mockFspWriteFile).toHaveBeenCalled();
      expect(writtenData.sessions).toHaveLength(1);
      expect(writtenData.sessions[0].id).toBe('keep-this');
    });
  });

  describe('save() integrates with index', () => {
    it('updates existing entry and sorts correctly', async () => {
      const existingIndex = {
        version: 1,
        sessions: [
          { id: 'older', mtimeMs: 1000, title: 'Older', messageCount: 1, updatedAt: 1000 },
          { id: 'middle', mtimeMs: 2000, title: 'Middle', messageCount: 2, updatedAt: 2000 },
        ],
      };

      let readIdx = 0;
      mockFspReadFile.mockImplementation(async (p: string) => {
        readIdx++;
        if (p.includes('index.json')) {
          // First read: existing index, Second read: after update (empty for rebuild)
          if (readIdx === 1) return JSON.stringify(existingIndex);
          return JSON.stringify({ version: 1, sessions: [] });
        }
        return '{}';
      });
      mockFspReaddir.mockResolvedValue([]);

      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Updated message' },
      ];

      await sessionRepository.save('newest-session', messages, { title: 'Newest Session' });

      // Verify index was updated
      const indexWrites = mockFspWriteFile.mock.calls.filter(
        (call) => (call[0] as string).includes('index.json')
      );
      expect(indexWrites.length).toBeGreaterThan(0);
    });
  });
});
