import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { GLOBAL_SESSION_HEADER } from '../__fixtures__/sessions.js';

/**
 * @group performance
 */
describe('JSONL Parsing - Performance Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-perf-jsonl-' + Date.now());
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

  test('parse session with mixed content types', () => {
    const mixedFile = join(GLOBAL_DIR, 'mixed_content.jsonl');

    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }], timestamp: Date.now() },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'Thinking...' }, { type: 'text', text: 'Response' }], timestamp: Date.now() + 1 },
      { role: 'user', content: [{ type: 'text', text: 'Use the tool' }], timestamp: Date.now() + 2 },
      { role: 'assistant', content: [{ type: 'toolCall', id: 'call1', name: 'bash', arguments: { command: 'ls' } }], timestamp: Date.now() + 3 },
      { role: 'tool', toolCallId: 'call1', toolName: 'bash', content: [{ type: 'text', text: 'output' }], isError: false, timestamp: Date.now() + 4 },
    ];

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...messages.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(mixedFile, sessionContent);

    const start = Date.now();
    const content = require('fs').readFileSync(mixedFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => JSON.parse(line));
    const elapsed = Date.now() - start;

    expect(parsed.length).toBe(6);
    expect(parsed[0]).toHaveProperty('type', 'session');
    expect(parsed[1]).toHaveProperty('role', 'user');
    expect(parsed[2]).toHaveProperty('content');
    expect(elapsed).toBeLessThan(50);
  });

  test('parse 1000-line session in < 50ms', () => {
    const thousandLineFile = join(GLOBAL_DIR, 'thousand_lines.jsonl');

    const lines: string[] = [JSON.stringify(GLOBAL_SESSION_HEADER)];
    for (let i = 0; i < 1000; i++) {
      lines.push(JSON.stringify({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Line ${i}` }],
        timestamp: Date.now() + i,
      }));
    }
    const sessionContent = lines.join('\n') + '\n';
    writeFileSync(thousandLineFile, sessionContent);

    const start = Date.now();
    const content = require('fs').readFileSync(thousandLineFile, 'utf-8');
    const parseLines = content.split('\n').filter(line => line.trim());
    parseLines.forEach(line => JSON.parse(line));
    const elapsed = Date.now() - start;

    expect(parseLines.length).toBe(1001);
    expect(elapsed).toBeLessThan(50);
  });

  test('verify JSONL format (newline-delimited JSON)', () => {
    const jsonlFile = join(GLOBAL_DIR, 'format_check.jsonl');

    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'First' }], timestamp: 1 },
      { role: 'assistant', content: [{ type: 'text', text: 'Second' }], timestamp: 2 },
    ];

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...messages.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(jsonlFile, sessionContent);

    const content = require('fs').readFileSync(jsonlFile, 'utf-8');
    const lines = content.split('\n');

    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    expect(nonEmptyLines.length).toBe(3);

    for (const line of nonEmptyLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  test('parse session with Chinese characters', () => {
    const chineseFile = join(GLOBAL_DIR, 'chinese_content.jsonl');

    const messages = [
      { role: 'user', content: [{ type: 'text', text: '你好世界' }], timestamp: Date.now() },
      { role: 'assistant', content: [{ type: 'text', text: '你好！有什么我可以帮助的吗？' }], timestamp: Date.now() + 1 },
    ];

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...messages.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(chineseFile, sessionContent);

    const start = Date.now();
    const content = require('fs').readFileSync(chineseFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => JSON.parse(line));
    const elapsed = Date.now() - start;

    expect(parsed.length).toBe(3);
    expect(parsed[1].content[0].text).toBe('你好世界');
    expect(elapsed).toBeLessThan(50);
  });
});