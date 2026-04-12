import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileTool } from '../../../../src/agent/tools/read_file.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

import * as fs from 'fs/promises';

describe('readFileTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read file successfully', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 11 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('Hello World');

    const result = await readFileTool.execute('test-id', { filePath: '/test/file.txt' });
    
    expect(result.content[0].text).toBe('Hello World');
    expect(result.details.success).toBe(true);
  });

  it('should handle file read error', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

    const result = await readFileTool.execute('test-id', { filePath: '/nonexistent.txt' });
    
    expect(result.content[0].text).toContain('Error: File not found');
    expect(result.details.success).toBe(false);
  });

  it('should handle large file (>5MB)', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 6 * 1024 * 1024 } as any); // 6MB

    const result = await readFileTool.execute('test-id', { filePath: '/large.txt' });
    
    expect(result.content[0].text).toContain('Error: File too large');
    expect(result.details.success).toBe(false);
  });
});
