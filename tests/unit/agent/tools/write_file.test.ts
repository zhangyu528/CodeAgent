import { describe, it, expect } from 'vitest';
import { writeFileTool } from '../../../../src/agent/tools/write_file';

describe('writeFileTool', () => {
  it('should have correct name and label', () => {
    expect(writeFileTool.name).toBe('write_file');
    expect(writeFileTool.label).toBe('Writing File');
  });

  it('should have correct parameters schema', () => {
    const params = writeFileTool.parameters;
    expect(params.shape).toHaveProperty('filePath');
    expect(params.shape).toHaveProperty('content');
  });

  it('should have description', () => {
    expect(typeof writeFileTool.description).toBe('string');
    expect(writeFileTool.description.length).toBeGreaterThan(0);
  });

  it('should have an execute function', () => {
    expect(typeof writeFileTool.execute).toBe('function');
  });

  it('should return an object with content and details when executed', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '/tmp/test-output.txt',
      content: 'hello world',
    });
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should return success message on successful write', async () => {
    const result = await writeFileTool.execute('test-id', {
      filePath: '/tmp/test-output.txt',
      content: 'hello world',
    });
    expect(result.content[0].text).toContain('successfully');
    expect(result.details.success).toBe(true);
    expect(result.details.filePath).toBe('/tmp/test-output.txt');
  });
});
