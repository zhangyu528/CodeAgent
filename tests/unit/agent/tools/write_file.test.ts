import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileTool } from '../../../../src/agent/tools/write_file.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import * as fs from 'fs/promises';
import * as path from 'path';

describe('writeFileTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset workspace root to project directory for tests
    vi.stubEnv('CODEAGENT_WORKSPACE_ROOT', '/mnt/d/work/project/CodeAgent');
  });

  it('should write file successfully within workspace', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await writeFileTool.execute('test-id', {
      filePath: '/mnt/d/work/project/CodeAgent/test-file.txt',
      content: 'Hello World'
    });

    expect(result.content[0].text).toContain('written successfully');
    expect(result.details.success).toBe(true);
  });

  it('should handle write error', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

    const result = await writeFileTool.execute('test-id', {
      filePath: '/mnt/d/work/project/CodeAgent/denied/file.txt',
      content: 'Hello'
    });

    expect(result.content[0].text).toContain('Error: Permission denied');
    expect(result.details.success).toBe(false);
  });

  it('should create parent directories', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await writeFileTool.execute('test-id', {
      filePath: '/mnt/d/work/project/CodeAgent/new/dir/file.txt',
      content: 'Hello'
    });

    expect(fs.mkdir).toHaveBeenCalledWith(path.resolve('/mnt/d/work/project/CodeAgent/new/dir'), { recursive: true });
  });

  it('should reject content that exceeds 10MB limit', async () => {
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const result = await writeFileTool.execute('test-id', {
      filePath: '/mnt/d/work/project/CodeAgent/test/large.txt',
      content: largeContent
    });

    expect(result.details.success).toBe(false);
    expect(result.content[0].text).toContain('Content too large');
  });

  // Security tests for path traversal protection
  it('should reject paths outside workspace root', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '/etc/passwd',
      content: 'malicious'
    });

    expect(result.details.success).toBe(false);
    expect(result.details.reason).toBe('path_outside_workspace');
    expect(result.content[0].text).toContain('Path outside workspace');
  });

  it('should reject path traversal attempts', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '/mnt/d/work/project/CodeAgent/../../../etc/passwd',
      content: 'malicious'
    });

    expect(result.details.success).toBe(false);
    expect(result.details.reason).toBe('path_outside_workspace');
  });

  it('should reject obfuscated path traversal', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '/mnt/d/work/project/CodeAgent/./../../etc/passwd',
      content: 'malicious'
    });

    expect(result.details.success).toBe(false);
    expect(result.details.reason).toBe('path_outside_workspace');
  });

  it('should reject home directory paths', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '~/.bashrc',
      content: 'malicious'
    });

    expect(result.details.success).toBe(false);
    expect(result.details.reason).toBe('path_outside_workspace');
  });

  it('should reject system paths like /etc', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '/tmp/../../../etc/shadow',
      content: 'malicious'
    });

    expect(result.details.success).toBe(false);
    expect(result.details.reason).toBe('path_outside_workspace');
  });
});
