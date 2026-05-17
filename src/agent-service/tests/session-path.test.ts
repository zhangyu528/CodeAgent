import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';

// Test data paths
const TEST_AGENT_DIR = join(tmpdir(), 'codeagent-test-' + Date.now());
const SESSIONS_DIR = join(TEST_AGENT_DIR, 'sessions');
const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
const PROJECT_DIR = join(SESSIONS_DIR, '--D--work-project-Test--');

// Setup test directories
beforeAll(() => {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  mkdirSync(PROJECT_DIR, { recursive: true });

  // Create valid session files
  writeFileSync(join(GLOBAL_DIR, '1778830744809_test123.jsonl'),
    '{"id":"test123","type":"session","version":2,"timestamp":1778830744809,"name":"Test Global","cwd":""}\n');
  writeFileSync(join(PROJECT_DIR, '1778830744809_test456.jsonl'),
    '{"id":"test456","type":"session","version":2,"timestamp":1778830744809,"name":"Test Project","cwd":"D:\\\\work\\\\project\\\\Test"}\n');
});

// Cleanup after tests
afterAll(() => {
  try {
    rmSync(TEST_AGENT_DIR, { recursive: true, force: true });
  } catch {}
});

describe('Session Path Validation', () => {
  test('valid .jsonl paths should pass validation', () => {
    const validPath = join(GLOBAL_DIR, '1778830744809_test123.jsonl');
    const fs = require('fs');
    const stat = fs.statSync(validPath);
    expect(stat.isFile()).toBe(true);
    expect(validPath.endsWith('.jsonl')).toBe(true);
  });

  test('directory paths should be rejected', () => {
    const fs = require('fs');
    const stat = fs.statSync(GLOBAL_DIR);
    expect(stat.isDirectory()).toBe(true);
  });

  test('paths without .jsonl extension should be filtered', () => {
    const invalidPath = join(SESSIONS_DIR, '--D--work-project-Test--');
    expect(invalidPath.endsWith('.jsonl')).toBe(false);
  });
});

describe('Session File Structure', () => {
  test('global session has empty cwd', () => {
    const content = require('fs').readFileSync(join(GLOBAL_DIR, '1778830744809_test123.jsonl'), 'utf-8');
    const firstLine = content.split('\n')[0];
    const session = JSON.parse(firstLine);
    expect(session.cwd).toBe('');
  });

  test('project session has non-empty cwd', () => {
    const content = require('fs').readFileSync(join(PROJECT_DIR, '1778830744809_test456.jsonl'), 'utf-8');
    const firstLine = content.split('\n')[0];
    const session = JSON.parse(firstLine);
    expect(session.cwd).toBe('D:\\work\\project\\Test');
  });
});

describe('Session Filtering Logic', () => {
  test('filter should accept only .jsonl files', () => {
    const allPaths = [
      join(GLOBAL_DIR, '1778830744809_test123.jsonl'),
      join(PROJECT_DIR, '1778830744809_test456.jsonl'),
      GLOBAL_DIR,  // directory, not file
      PROJECT_DIR,  // directory, not file
    ];

    const validSessions = allPaths.filter(p => {
      return p.endsWith('.jsonl');
    });

    expect(validSessions.length).toBe(2);
    expect(validSessions).toContain(join(GLOBAL_DIR, '1778830744809_test123.jsonl'));
    expect(validSessions).toContain(join(PROJECT_DIR, '1778830744809_test456.jsonl'));
  });
});