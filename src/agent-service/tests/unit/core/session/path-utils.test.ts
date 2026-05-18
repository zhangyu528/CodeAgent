import { describe, test, expect } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Path Utilities', () => {
  describe('Session path encoding', () => {
    test('encodes project path correctly', () => {
      const projectPath = 'D:\\work\\project\\Test';
      const encoded = projectPath.replace(/[\\/:]/g, '-');
      expect(encoded).toBe('D--work-project-Test');
    });

    test('session directory name format', () => {
      const projectPath = 'D:\\work\\project\\Test';
      const safe = projectPath.replace(/^[\\/]/, '').replace(/[\\/:]/g, '-');
      const sessionDir = `--${safe}--`;

      expect(sessionDir).toBe('--D--work-project-Test--');
    });

    test('decodes session directory name', () => {
      const sessionDir = '--D--work-project-Test--';
      const inner = sessionDir.slice(2, -2);
      const parts = inner.split('--');

      expect(parts[0]).toBe('D');
    });
  });

  describe('File path validation', () => {
    test('validates .jsonl extension', () => {
      const validPath = join(tmpdir(), 'session.jsonl');
      expect(validPath.endsWith('.jsonl')).toBe(true);
    });

    test('detects non-.jsonl path', () => {
      const invalidPath = join(tmpdir(), 'session.txt');
      expect(invalidPath.endsWith('.jsonl')).toBe(false);
    });

    test('directory path detection', () => {
      const dirPath = join(tmpdir(), 'sessions', '__global__');
      // A directory path typically doesn't end with .jsonl
      expect(dirPath.endsWith('.jsonl')).toBe(false);
    });
  });

  describe('Timestamp generation', () => {
    test('generates valid timestamp', () => {
      const timestamp = Date.now();
      expect(timestamp).toBeGreaterThan(0);
      expect(typeof timestamp).toBe('number');
    });

    test('timestamp is ISO format compatible', () => {
      const timestamp = Date.now();
      const date = new Date(timestamp);

      expect(date instanceof Date).toBe(true);
      expect(isNaN(date.getTime())).toBe(false);
    });
  });
});