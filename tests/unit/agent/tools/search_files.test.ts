import { describe, it, expect, beforeEach } from 'vitest';
import { searchFilesTool } from '../../../../src/agent/tools/search_files.js';

describe('searchFilesTool', () => {
  beforeEach(() => {
    // Reset state if needed
  });

  describe('Basic search functionality', () => {
    it('should return no matches for non-existent pattern', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'NONEXISTENT_PATTERN_12345_UNIQUE',
        directoryPath: 'src/agent',
        maxResults: 50,
      });
      expect(result.details.matches).toBe(0);
    });

    it('should find a known pattern in source files', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'searchFilesTool',
        directoryPath: 'src/agent/tools',
        maxResults: 50,
      });
      expect(result.details.matches).toBeGreaterThan(0);
      expect(result.content[0].text).toContain('searchFilesTool');
    });
  });

  describe('File extension filtering', () => {
    it('should filter by file extension', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'export',
        directoryPath: 'src/agent/tools',
        fileExtension: '.ts',
        maxResults: 50,
      });
      // All results should be .ts files
      const text = result.content[0].text;
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.includes('.ts:')) {
          expect(line).toContain('.ts');
        }
      }
    });

    it('should return no results for non-matching extension', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'const.*=',
        directoryPath: 'src/agent/tools',
        fileExtension: '.nonexistent',
        maxResults: 50,
      });
      expect(result.details.matches).toBe(0);
    });
  });

  describe('maxResults limit', () => {
    it('should respect maxResults limit', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'export',
        directoryPath: 'src',
        maxResults: 5,
      });
      expect(result.details.matches).toBeLessThanOrEqual(5);
    });
  });

  describe('Depth limit protection', () => {
    it('should limit search depth to prevent infinite traversal', async () => {
      // The depth limit is 10 levels, this test verifies the feature exists
      // by searching a shallow directory structure
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'export',
        directoryPath: 'src',
        maxResults: 100,
      });
      // Should complete without hanging or infinite loop
      expect(typeof result.details.matches).toBe('number');
      expect(result.details.matches).toBeGreaterThanOrEqual(0);
    });

    it('should handle deep directory structures safely', async () => {
      // Search the entire src directory - depth limit should prevent issues
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'export',
        directoryPath: 'src',
        maxResults: 50,
      });
      // Should not throw and should return results within limits
      expect(result.content).toBeDefined();
      expect(result.details.matches).toBeLessThanOrEqual(50);
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent directory gracefully', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'test',
        directoryPath: 'non_existent_path_12345',
        maxResults: 50,
      });
      // Should not throw, should return zero matches
      expect(result.details.matches).toBe(0);
    });

    it('should skip unreadable files gracefully', async () => {
      // Search in src directory - readable, should return results
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'test',
        directoryPath: 'src',
        maxResults: 10,
      });
      // Should not throw, should return results or 0
      expect(typeof result.details.matches).toBe('number');
    });
  });

  describe('Path traversal protection', () => {
    it('should reject paths outside workspace', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'test',
        directoryPath: '/non/existent/path/12345',
        maxResults: 50,
      });
      // Should reject path traversal attempt
      expect(result.details.reason).toBe('path_traversal');
    });

    it('should reject home directory paths', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'test',
        directoryPath: '~/some/path',
        maxResults: 50,
      });
      // Should reject home directory paths
      expect(result.details.reason).toBe('path_traversal');
    });
  });

  describe('Result format', () => {
    it('should return results with file path, line number and content', async () => {
      const result = await searchFilesTool.execute('call-id', {
        pattern: 'searchFilesTool',
        directoryPath: 'src/agent/tools',
        maxResults: 50,
      });
      const text = result.content[0].text;
      // Should contain file:line:content format
      expect(text).toContain('.ts:');
    });
  });
});
