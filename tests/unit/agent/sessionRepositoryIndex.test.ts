/**
 * Unit tests for session index integration in JsonSessionRepository.save()
 * 
 * Tests that save() correctly updates the session index after each save.
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

describe('JsonSessionRepository index integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Default "good" state
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

  describe('save() updates index', () => {
    it('writes to index.json after saving a new session', async () => {
      // First read for save (empty index), second read for cleanupTempFiles
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify({ version: 1, sessions: [] }));
      mockFspReaddir.mockResolvedValueOnce([]);

      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Hello' },
      ];

      await sessionRepository.save('new-session', messages);

      // Should have written to index.json
      expect(mockFspWriteFile).toHaveBeenCalled();
      const indexCall = mockFspWriteFile.mock.calls.find(
        (call) => (call[0] as string).includes('index.json')
      );
      expect(indexCall).toBeDefined();
    });

    it('updates existing entry in index after resaving session', async () => {
      const existingIndex = {
        version: 1,
        sessions: [
          { id: 'existing-session', mtimeMs: 1000, title: 'Old Title', messageCount: 1, updatedAt: 1000 },
        ],
      };
      // First read for updateIndex (existing index), second for atomicWriteJson session file
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify(existingIndex));
      mockFspReaddir.mockResolvedValueOnce([]);

      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Updated content' },
      ];

      await sessionRepository.save('existing-session', messages, { title: 'New Title' });

      const indexWriteCall = mockFspWriteFile.mock.calls.find(
        (call) => (call[0] as string).includes('index.json')
      );
      expect(indexWriteCall).toBeDefined();
      const writtenData = JSON.parse(indexWriteCall![1] as string);
      expect(writtenData.sessions[0].title).toBe('New Title');
    });

    it('does not fail when index write fails (graceful degradation)', async () => {
      mockFspReadFile.mockResolvedValueOnce(JSON.stringify({ version: 1, sessions: [] }));
      mockFspReaddir.mockResolvedValueOnce([]);
      // Make index write fail
      mockFspWriteFile.mockRejectedValueOnce(new Error('EIO'));

      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Hello' },
      ];

      // Should not throw — save succeeds even if index update fails
      await expect(
        sessionRepository.save('session-id', messages)
      ).resolves.not.toThrow();
    });
  });
});
