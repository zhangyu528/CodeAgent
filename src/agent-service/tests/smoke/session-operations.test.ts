import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { GLOBAL_SESSION_HEADER, SAMPLE_MESSAGES } from '../__fixtures__/sessions.js';

/**
 * @group smoke
 */
describe('Session Operations - Smoke Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-smoke-session-' + Date.now());
  const SESSIONS_DIR = join(TEST_DIR, 'sessions');
  const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
  const SESSION_FILE = join(GLOBAL_DIR, 'smoke_test_session.jsonl');

  let service: any;

  beforeAll(async () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...SAMPLE_MESSAGES.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(SESSION_FILE, sessionContent);

    service = await createAgentService();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('listSessions returns array', async () => {
    const sessions = await service.listSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test('listSessionGroups returns expected structure', async () => {
    const groups = await service.listSessionGroups();
    expect(groups).toHaveProperty('global');
    expect(Array.isArray(groups.global)).toBe(true);
    expect(groups).toHaveProperty('byProject');
    expect(typeof groups.byProject).toBe('object');
  });

  test('createGlobalSession creates session and returns path', async () => {
    const result = await service.createGlobalSession('smoke-test-' + Date.now());
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('sessionPath');
    expect(typeof result.sessionPath).toBe('string');
    expect(result.sessionPath.endsWith('.jsonl')).toBe(true);
  });

  test('switchSession with valid path does not throw', async () => {
    await expect(
      service.switchSession(SESSION_FILE, '')
    ).resolves.not.toThrow();
  });

  test('getSessionId returns string after switch', async () => {
    await service.switchSession(SESSION_FILE, '');
    const sessionId = service.getSessionId();
    expect(sessionId === null || typeof sessionId === 'string').toBe(true);
  });

  test('getMessages returns array after switch', async () => {
    await service.switchSession(SESSION_FILE, '');
    const messages = service.getMessages();
    expect(Array.isArray(messages)).toBe(true);
  });
});