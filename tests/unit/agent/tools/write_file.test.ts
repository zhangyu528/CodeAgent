import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileTool } from '../../../../src/agent/tools/write_file.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import * as fs from 'fs/promises';

describe('writeFileTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write file successfully', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await writeFileTool.execute('test-id', { 
      filePath: '/test/file.txt', 
      content: 'Hello World' 
    });
    
    expect(result.content[0].text).toContain('written successfully');
    expect(result.details.success).toBe(true);
  });

  it('should handle write error', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

    const result = await writeFileTool.execute('test-id', { 
      filePath: '/denied/file.txt', 
      content: 'Hello' 
    });
    
    expect(result.content[0].text).toContain('Error: Permission denied');
    expect(result.details.success).toBe(false);
  });

  it('should create parent directories', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await writeFileTool.execute('test-id', { 
      filePath: '/new/dir/file.txt', 
      content: 'Hello' 
    });
    
    expect(fs.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
  });

  it('should reject content that exceeds 10MB limit', async () => {
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const result = await writeFileTool.execute('test-id', {
      filePath: '/test/large.txt',
      content: largeContent
    });
    
    expect(result.details.success).toBe(false);
    expect(result.content[0].text).toContain('Content too large');
    expect((result.content[0] as any).text).toContain('10MB');
  });
});
