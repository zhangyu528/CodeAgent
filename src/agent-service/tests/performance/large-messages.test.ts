import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'fs';
import { GLOBAL_SESSION_HEADER, SAMPLE_MESSAGES_LONG } from '../__fixtures__/sessions.js';

/**
 * @group performance
 */
describe('Large Messages - Performance Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-perf-large-' + Date.now());
  const SESSIONS_DIR = join(TEST_DIR, 'sessions');
  const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');

  beforeAll(() => {
    mkdirSync(GLOBAL_DIR, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('parse SAMPLE_MESSAGES_LONG (15+ lines JSONL)', () => {
    const sessionFile = join(GLOBAL_DIR, 'large_messages.jsonl');

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...SAMPLE_MESSAGES_LONG.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(sessionFile, sessionContent);

    const start = Date.now();
    const content = require('fs').readFileSync(sessionFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => JSON.parse(line));
    const elapsed = Date.now() - start;

    expect(parsed.length).toBeGreaterThan(5);
    expect(elapsed).toBeLessThan(50);
  });

  test('handle 100+ message session file', () => {
    const largeFile = join(GLOBAL_DIR, 'hundred_messages.jsonl');

    const messages = [];
    for (let i = 0; i < 100; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${i}` }],
        timestamp: Date.now() + i,
      });
    }

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...messages.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(largeFile, sessionContent);

    const start = Date.now();
    const content = require('fs').readFileSync(largeFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => JSON.parse(line));
    const elapsed = Date.now() - start;

    expect(parsed.length).toBe(101);
    expect(elapsed).toBeLessThan(100);
  });

  test('large session file size is reasonable', () => {
    const largeFile = join(GLOBAL_DIR, 'size_check.jsonl');

    const messages = [];
    for (let i = 0; i < 50; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `This is message number ${i} with some extra content to make the file larger` }],
        timestamp: Date.now() + i,
      });
    }

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...messages.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(largeFile, sessionContent);

    const stats = statSync(largeFile);
    expect(stats.size).toBeLessThan(100 * 1024);
  });

  test('read large session file efficiently', () => {
    const largeFile = join(GLOBAL_DIR, 'read_perf.jsonl');

    const messages = [];
    for (let i = 0; i < 80; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Performance test message ${i}` }],
        timestamp: Date.now() + i,
      });
    }

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...messages.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(largeFile, sessionContent);

    const start = Date.now();
    require('fs').readFileSync(largeFile, 'utf-8');
    const readElapsed = Date.now() - start;

    expect(readElapsed).toBeLessThan(50);
  });
});