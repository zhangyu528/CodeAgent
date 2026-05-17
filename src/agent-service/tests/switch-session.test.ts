import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, statSync } from 'fs';
import { activateSession } from '../src/core/session/pool.js';

// Test data paths - use constant so they can be accessed in all tests
const TEST_AGENT_DIR = join(tmpdir(), 'codeagent-switch-test-' + Date.now());
const SESSIONS_DIR = join(TEST_AGENT_DIR, 'sessions');
const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
const PROJECT_DIR = join(SESSIONS_DIR, '--D--work-project-Test--');
const GLOBAL_SESSION_FILE = join(GLOBAL_DIR, '1778830744809_global.jsonl');
const PROJECT_SESSION_FILE = join(PROJECT_DIR, '1778830744809_project.jsonl');

describe('switchSession with Directory Path', () => {
  beforeAll(() => {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    mkdirSync(PROJECT_DIR, { recursive: true });

    writeFileSync(GLOBAL_SESSION_FILE,
      '{"id":"global1","type":"session","version":2,"timestamp":1778830744809,"name":"Global Session","cwd":""}\n');
    writeFileSync(PROJECT_SESSION_FILE,
      '{"id":"project1","type":"session","version":2,"timestamp":1778830744809,"name":"Project Session","cwd":"D:\\\\work\\\\project\\\\Test"}\n');
  });

  afterAll(() => {
    try {
      rmSync(TEST_AGENT_DIR, { recursive: true, force: true });
    } catch {}
  });

  test('activateSession rejects directory path', async () => {
    await expect(activateSession(GLOBAL_DIR, '')).rejects.toThrow('Session path is a directory');
  });

  test('activateSession rejects project directory path', async () => {
    await expect(activateSession(PROJECT_DIR, 'D:\\work\\project\\Test')).rejects.toThrow('Session path is a directory');
  });

  test('activateSession accepts valid .jsonl file path', async () => {
    try {
      await activateSession(GLOBAL_SESSION_FILE, '');
    } catch (err: any) {
      expect(err.message).not.toContain('is a directory');
    }
  });

  test('activateSession rejects empty path', async () => {
    await expect(activateSession('', '')).rejects.toThrow('Invalid session path');
  });

  test('activateSession rejects undefined path', async () => {
    await expect(activateSession(undefined as any, '')).rejects.toThrow('Invalid session path');
  });

  test('GLOBAL_DIR is a directory', () => {
    const stat = statSync(GLOBAL_DIR);
    expect(stat.isDirectory()).toBe(true);
  });

  test('PROJECT_DIR is a directory', () => {
    const stat = statSync(PROJECT_DIR);
    expect(stat.isDirectory()).toBe(true);
  });

  test('valid session file is NOT a directory', () => {
    const stat = statSync(GLOBAL_SESSION_FILE);
    expect(stat.isFile()).toBe(true);
    expect(stat.isDirectory()).toBe(false);
  });

  test('directory path does not end with .jsonl', () => {
    expect(GLOBAL_DIR.endsWith('.jsonl')).toBe(false);
    expect(PROJECT_DIR.endsWith('.jsonl')).toBe(false);
  });

  test('valid session file ends with .jsonl', () => {
    expect(GLOBAL_SESSION_FILE.endsWith('.jsonl')).toBe(true);
  });
});