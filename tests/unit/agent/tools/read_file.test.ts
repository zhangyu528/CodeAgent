import { describe, it, expect } from 'vitest';
import { readFileTool } from '../../../../src/agent/tools/read_file';

describe('readFileTool', () => {
  it('should have correct name and label', () => {
    expect(readFileTool.name).toBe('read_file');
    expect(readFileTool.label).toBe('Reading File');
  });

  it('should have correct parameters schema', () => {
    const params = readFileTool.parameters;
    expect(params.shape).toHaveProperty('filePath');
  });

  it('should have description', () => {
    expect(typeof readFileTool.description).toBe('string');
    expect(readFileTool.description.length).toBeGreaterThan(0);
  });

  it('should have an execute function', () => {
    expect(typeof readFileTool.execute).toBe('function');
  });

  it('should return an object with content and details when executed', async () => {
    const result = await readFileTool.execute('test-id', { filePath: '/nonexistent/file.txt' });
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should return error in content when file not found', async () => {
    const result = await readFileTool.execute('test-id', { filePath: '/nonexistent/file.txt' });
    expect(result.content[0].text).toContain('Error:');
    expect(result.details.success).toBe(false);
    expect(result.details.filePath).toBe('/nonexistent/file.txt');
  });
});
