import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDirectoryTool } from '../../../../src/agent/tools/list_directory.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
}));

import * as fs from 'fs/promises';

describe('listDirectoryTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list directory contents successfully', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: 'src' },
      { isDirectory: () => false, name: 'package.json' },
    ] as any);

    const result = await listDirectoryTool.execute('test-id', { directoryPath: '/test' });
    
    expect(result.content[0].text).toContain('[DIR] src');
    expect(result.content[0].text).toContain('[FILE] package.json');
    expect(result.details.success).toBe(true);
  });

  it('should handle empty directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const result = await listDirectoryTool.execute('test-id', { directoryPath: '/empty' });
    
    expect(result.content[0].text).toBe('(empty)');
    expect(result.details.success).toBe(true);
  });

  it('should handle directory read error', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

    const result = await listDirectoryTool.execute('test-id', { directoryPath: '/denied' });
    
    expect(result.content[0].text).toContain('Error: Permission denied');
    expect(result.details.success).toBe(false);
  });
});
