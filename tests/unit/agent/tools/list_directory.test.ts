import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listDirectoryTool } from '../../../../src/agent/tools/list_directory.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
}));

import * as fs from 'fs/promises';

// Save original env
const originalEnv = { ...process.env };

describe('listDirectoryTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set workspace root env var before each test
    process.env.CODEAGENT_WORKSPACE_ROOT = '/mnt/d/work/project/CodeAgent';
  });

  afterEach(() => {
    // Restore original env after each test
    Object.assign(process.env, originalEnv);
  });

  it('should list directory contents successfully', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: 'src' },
      { isDirectory: () => false, name: 'package.json' },
    ] as any);

    const result = await listDirectoryTool.execute('test-id', { directoryPath: 'src' });
    
    expect(result.content[0].text).toContain('[DIR] src');
    expect(result.content[0].text).toContain('[FILE] package.json');
    expect(result.details.success).toBe(true);
  });

  it('should handle empty directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const result = await listDirectoryTool.execute('test-id', { directoryPath: 'src/empty' });
    
    expect(result.content[0].text).toBe('(empty)');
    expect(result.details.success).toBe(true);
  });

  it('should handle directory read error', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

    const result = await listDirectoryTool.execute('test-id', { directoryPath: 'src/denied' });
    
    expect(result.content[0].text).toContain('Error: Permission denied');
    expect(result.details.success).toBe(false);
  });

  it('should reject path traversal attempts', async () => {
    const result = await listDirectoryTool.execute('test-id', { directoryPath: '../../../etc' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Pp]ath [Tt]raversal|outside workspace/);
  });

  it('should reject absolute system paths', async () => {
    const result = await listDirectoryTool.execute('test-id', { directoryPath: '/etc' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Aa]ccess denied|outside workspace/);
  });

  it('should reject home directory paths', async () => {
    const result = await listDirectoryTool.execute('test-id', { directoryPath: '~/.bashrc' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Aa]ccess denied|outside workspace/);
  });
});
