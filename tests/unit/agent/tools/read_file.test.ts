import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { readFileTool } from '../../../../src/agent/tools/read_file';

const TEST_DIR = '/tmp/read_file_test';

describe('readFileTool', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('metadata', () => {
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
  });

  describe('execute', () => {
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

    it('should read a real file successfully', async () => {
      const filePath = path.join(TEST_DIR, 'sample.txt');
      const content = 'Hello, world!\nLine 2\nLine 3';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await readFileTool.execute('test-id', { filePath });
      expect(result.details.success).toBe(true);
      expect(result.details.filePath).toBe(filePath);
      expect(result.content[0].text).toBe(content);
    });

    it('should read an empty file', async () => {
      const filePath = path.join(TEST_DIR, 'empty.txt');
      await fs.writeFile(filePath, '', 'utf-8');

      const result = await readFileTool.execute('test-id', { filePath });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe('');
    });

    it('should read a file with special characters', async () => {
      const filePath = path.join(TEST_DIR, 'special.txt');
      const content = 'Hello 世界! 🌍\n中文测试\nemoji: 🎉';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await readFileTool.execute('test-id', { filePath });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe(content);
    });

    it('should read a file with binary-like content (utf-8)', async () => {
      const filePath = path.join(TEST_DIR, 'binary.txt');
      const content = 'Tab:\tNewline:\nBackslash: \\';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await readFileTool.execute('test-id', { filePath });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe(content);
    });

    it('should handle multi-line content', async () => {
      const filePath = path.join(TEST_DIR, 'multiline.txt');
      const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];
      const content = lines.join('\n');
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await readFileTool.execute('test-id', { filePath });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe(content);
    });
  });
});
