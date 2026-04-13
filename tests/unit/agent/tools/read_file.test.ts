import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileTool } from '../../../../src/agent/tools/read_file.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

import * as fs from 'fs/promises';

// Save original env
const originalEnv = { ...process.env };

describe('readFileTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set workspace root env var before each test
    process.env.CODEAGENT_WORKSPACE_ROOT = '/mnt/d/work/project/CodeAgent';
  });

  afterEach(() => {
    // Restore original env after each test
    Object.assign(process.env, originalEnv);
  });

  it('should read file successfully', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 11 } as any);
    vi.mocked(fs.readFile).mockResolvedValueOnce('Hello World');

    const result = await readFileTool.execute('test-id', { filePath: 'src/test.txt' });
    
    expect(result.content[0].text).toBe('Hello World');
    expect(result.details.success).toBe(true);
  });

  it('should handle file read error', async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('File not found'));

    const result = await readFileTool.execute('test-id', { filePath: 'src/nonexistent.txt' });
    
    expect(result.content[0].text).toContain('Error: File not found');
    expect(result.details.success).toBe(false);
  });

  it('should handle large file (>5MB)', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 6 * 1024 * 1024 } as any); // 6MB

    const result = await readFileTool.execute('test-id', { filePath: 'src/large.txt' });
    
    expect(result.content[0].text).toContain('Error: File too large');
    expect(result.details.success).toBe(false);
  });

  it('should reject deep path traversal attempts', async () => {
    const result = await readFileTool.execute('test-id', { filePath: '../../../etc/passwd' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Pp]ath [Tt]raversal|outside workspace/);
  });

  it('should reject absolute system paths like /etc/passwd', async () => {
    const result = await readFileTool.execute('test-id', { filePath: '/etc/passwd' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Aa]ccess denied|outside workspace/);
  });

  it('should reject obfuscated paths like /a/../b/../c', async () => {
    const result = await readFileTool.execute('test-id', { filePath: '/a/../b/../c' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Aa]ccess denied|outside workspace/);
  });

  it('should reject home directory paths like ~/.bashrc', async () => {
    const result = await readFileTool.execute('test-id', { filePath: '~/.bashrc' });
    expect(result.details.success).toBe(false);
    expect((result.content[0] as any).text).toMatch(/[Aa]ccess denied|outside workspace/);
  });

  it('should allow paths within workspace root', async () => {
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 11 } as any);
    vi.mocked(fs.readFile).mockResolvedValueOnce('Hello World');

    const result = await readFileTool.execute('test-id', { filePath: 'src/test.txt' });
    expect(result.details.success).toBe(true);
  });
});
