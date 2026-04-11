import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { listDirectoryTool } from '../../../../src/agent/tools/list_directory';

const TEST_DIR = '/tmp/list_directory_test';

describe('listDirectoryTool', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    // Create test structure
    await fs.mkdir(path.join(TEST_DIR, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1', 'utf-8');
    await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2', 'utf-8');
    await fs.writeFile(path.join(TEST_DIR, 'file3.md'), 'content3', 'utf-8');
    await fs.writeFile(path.join(TEST_DIR, '.hidden'), 'hidden content', 'utf-8');
    await fs.writeFile(path.join(TEST_DIR, 'subdir', 'nested.txt'), 'nested', 'utf-8');
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('metadata', () => {
    it('should have correct name and label', () => {
      expect(listDirectoryTool.name).toBe('list_directory');
      expect(listDirectoryTool.label).toBe('Listing Directory');
    });

    it('should have correct parameters schema', () => {
      const params = listDirectoryTool.parameters;
      expect(params.shape).toHaveProperty('directoryPath');
    });

    it('should have description', () => {
      expect(typeof listDirectoryTool.description).toBe('string');
      expect(listDirectoryTool.description.length).toBeGreaterThan(0);
    });

    it('should have an execute function', () => {
      expect(typeof listDirectoryTool.execute).toBe('function');
    });
  });

  describe('execute', () => {
    it('should return an object with content and details when executed', async () => {
      const result = await listDirectoryTool.execute('test-id', { directoryPath: TEST_DIR });
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should return error for nonexistent directory', async () => {
      const result = await listDirectoryTool.execute('test-id', { directoryPath: '/nonexistent/directory' });
      expect(result.content[0].text).toContain('Error:');
      expect(result.details.success).toBe(false);
      expect(result.details.directoryPath).toBe('/nonexistent/directory');
    });

    it('should list files and directories with [DIR] and [FILE] prefixes', async () => {
      const result = await listDirectoryTool.execute('test-id', { directoryPath: TEST_DIR });
      expect(result.details.success).toBe(true);
      expect(result.details.directoryPath).toBe(TEST_DIR);
      const text = result.content[0].text;
      expect(text).toContain('[DIR]');
      expect(text).toContain('[FILE]');
    });

    it('should correctly identify directories vs files', async () => {
      const result = await listDirectoryTool.execute('test-id', { directoryPath: TEST_DIR });
      const text = result.content[0].text;
      expect(text).toContain('[DIR] subdir');
      expect(text).toContain('[FILE] file1.txt');
      expect(text).toContain('[FILE] file2.txt');
      expect(text).toContain('[FILE] file3.md');
    });

    it('should list all files including hidden ones', async () => {
      const result = await listDirectoryTool.execute('test-id', { directoryPath: TEST_DIR });
      const text = result.content[0].text;
      expect(text).toContain('.hidden');
    });

    it('should handle empty directory', async () => {
      const emptyDir = path.join(TEST_DIR, 'empty');
      await fs.mkdir(emptyDir, { recursive: true });

      const result = await listDirectoryTool.execute('test-id', { directoryPath: emptyDir });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe('(empty)');
    });

    it('should list nested directory contents', async () => {
      const result = await listDirectoryTool.execute('test-id', { directoryPath: path.join(TEST_DIR, 'subdir') });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('[FILE] nested.txt');
    });

    it('should handle directories with many items', async () => {
      const manyDir = path.join(TEST_DIR, 'many');
      await fs.mkdir(manyDir, { recursive: true });
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(path.join(manyDir, `file${i}.txt`), `content${i}`, 'utf-8');
      }

      const result = await listDirectoryTool.execute('test-id', { directoryPath: manyDir });
      const text = result.content[0].text;
      for (let i = 0; i < 20; i++) {
        expect(text).toContain(`[FILE] file${i}.txt`);
      }
    });

    it('should handle non-empty directory with mixed content', async () => {
      const mixedDir = path.join(TEST_DIR, 'mixed');
      await fs.mkdir(path.join(mixedDir, 'a'), { recursive: true });
      await fs.mkdir(path.join(mixedDir, 'b'), { recursive: true });
      await fs.writeFile(path.join(mixedDir, 'x.txt'), 'x', 'utf-8');
      await fs.writeFile(path.join(mixedDir, 'y.txt'), 'y', 'utf-8');

      const result = await listDirectoryTool.execute('test-id', { directoryPath: mixedDir });
      const text = result.content[0].text;
      expect(text).toContain('[DIR] a');
      expect(text).toContain('[DIR] b');
      expect(text).toContain('[FILE] x.txt');
      expect(text).toContain('[FILE] y.txt');
    });
  });
});
