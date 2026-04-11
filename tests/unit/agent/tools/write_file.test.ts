import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { writeFileTool } from '../../../../src/agent/tools/write_file';

const TEST_DIR = '/tmp/write_file_test';

describe('writeFileTool', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('metadata', () => {
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
  });

  describe('execute', () => {
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
        filePath: path.join(TEST_DIR, 'test1.txt'),
        content: 'hello world',
      });
      expect(result.content[0].text).toContain('successfully');
      expect(result.details.success).toBe(true);
      expect(result.details.filePath).toBe(path.join(TEST_DIR, 'test1.txt'));
    });

    it('should actually write content to a new file', async () => {
      const filePath = path.join(TEST_DIR, 'actual_write.txt');
      const content = 'file content here';
      await writeFileTool.execute('test-id', { filePath, content });

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(TEST_DIR, 'overwrite.txt');
      await fs.writeFile(filePath, 'original content', 'utf-8');

      await writeFileTool.execute('test-id', { filePath, content: 'new content' });

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe('new content');
    });

    it('should create nested directories automatically', async () => {
      const filePath = path.join(TEST_DIR, 'nested/deep/dir/file.txt');
      const content = 'nested content';

      const result = await writeFileTool.execute('test-id', { filePath, content });
      expect(result.details.success).toBe(true);

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe(content);
    });

    it('should write multi-line content', async () => {
      const filePath = path.join(TEST_DIR, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3';

      await writeFileTool.execute('test-id', { filePath, content });

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe(content);
    });

    it('should write special characters and unicode', async () => {
      const filePath = path.join(TEST_DIR, 'unicode.txt');
      const content = 'Hello 世界! 🌍\nEmoji: 🎉';

      await writeFileTool.execute('test-id', { filePath, content });

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe(content);
    });

    it('should write empty content', async () => {
      const filePath = path.join(TEST_DIR, 'empty.txt');

      await writeFileTool.execute('test-id', { filePath, content: '' });

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe('');
    });

    it('should handle binary-like content', async () => {
      const filePath = path.join(TEST_DIR, 'tabs.txt');
      const content = 'Tab:\tEnd';

      await writeFileTool.execute('test-id', { filePath, content });

      const readBack = await fs.readFile(filePath, 'utf-8');
      expect(readBack).toBe(content);
    });
  });
});
