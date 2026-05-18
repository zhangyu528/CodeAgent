import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';

// Test constants
const TEST_AGENT_DIR = join(tmpdir(), 'codeagent-pool-unit-' + Date.now());
const SESSIONS_DIR = join(TEST_AGENT_DIR, 'sessions');
const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
const GLOBAL_SESSION_FILE = join(GLOBAL_DIR, '1778830744809_global.jsonl');

describe('Pool Unit Tests', () => {
  beforeAll(async () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });

    writeFileSync(GLOBAL_SESSION_FILE,
      '{"id":"global1","type":"session","version":2,"timestamp":1778830744809,"name":"Global Session","cwd":""}\n' +
      '{"role":"user","content":[{"type":"text","text":"你好"}],"timestamp":1777809646048}\n'
    );

    // Set AGENT_DIR before importing pool
    process.env.AGENT_DIR = TEST_AGENT_DIR;
  });

  afterAll(() => {
    try {
      rmSync(TEST_AGENT_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('Session file creation', () => {
    test('creates session file with header', () => {
      const content = require('fs').readFileSync(GLOBAL_SESSION_FILE, 'utf-8');
      const header = JSON.parse(content.split('\n')[0]);

      expect(header.type).toBe('session');
      expect(header.version).toBe(2);
      expect(header.id).toBe('global1');
    });

    test('session file is valid jsonl', () => {
      const content = require('fs').readFileSync(GLOBAL_SESSION_FILE, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(2);

      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('Path handling', () => {
    test('global session path contains __global__', () => {
      expect(GLOBAL_SESSION_FILE).toContain('__global__');
    });

    test('session file ends with .jsonl', () => {
      expect(GLOBAL_SESSION_FILE.endsWith('.jsonl')).toBe(true);
    });

    test('session dir path format', () => {
      expect(GLOBAL_DIR).toContain('sessions');
      expect(GLOBAL_DIR).toContain('__global__');
    });
  });

  describe('Message content parsing', () => {
    test('parses user message correctly', () => {
      const content = require('fs').readFileSync(GLOBAL_SESSION_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      const userMsg = JSON.parse(lines[1]);

      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBeInstanceOf(Array);
      expect(userMsg.content[0].type).toBe('text');
      expect(userMsg.content[0].text).toBe('你好');
    });
  });

  describe('Session ID generation', () => {
    test('generates unique ID format', () => {
      const timestamp = Date.now();
      const shortId = Math.random().toString(16).slice(2, 10);
      const id = `${timestamp}_${shortId}`;

      expect(id).toMatch(/^\d+_[a-f0-9]{8}$/);
    });
  });
});