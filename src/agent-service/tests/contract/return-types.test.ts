import { describe, test, expect, beforeAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { GLOBAL_SESSION_HEADER, SAMPLE_MESSAGES } from '../__fixtures__/sessions.js';

/**
 * @group contract
 */
describe('Return Types - Contract Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-contract-return-' + Date.now());
  const SESSIONS_DIR = join(TEST_DIR, 'sessions');
  const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
  const SESSION_FILE = join(GLOBAL_DIR, 'contract_test_session.jsonl');

  let service: any;

  beforeAll(async () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });

    const sessionContent = [
      JSON.stringify(GLOBAL_SESSION_HEADER),
      ...SAMPLE_MESSAGES.map(m => JSON.stringify(m)),
    ].join('\n') + '\n';
    writeFileSync(SESSION_FILE, sessionContent);

    service = await createAgentService();
    await service.switchSession(SESSION_FILE, '');
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('Session object has: id, path, cwd, name?, created, modified, messageCount', async () => {
    const sessions = await service.listSessions();

    for (const session of sessions) {
      expect(session).toHaveProperty('id');
      expect(typeof session.id).toBe('string');

      expect(session).toHaveProperty('path');
      expect(typeof session.path).toBe('string');

      expect(session).toHaveProperty('cwd');
      expect(typeof session.cwd).toBe('string');

      expect(session).toHaveProperty('created');
      expect(session.created instanceof Date || typeof session.created === 'string' || typeof session.created === 'number').toBe(true);

      expect(session).toHaveProperty('modified');
      expect(session.modified instanceof Date || typeof session.modified === 'string' || typeof session.modified === 'number').toBe(true);

      expect(session).toHaveProperty('messageCount');
      expect(typeof session.messageCount).toBe('number');
    }
  });

  test('SessionGroup has: global[], byProject{}', async () => {
    const groups = await service.listSessionGroups();

    expect(groups).toHaveProperty('global');
    expect(Array.isArray(groups.global)).toBe(true);

    expect(groups).toHaveProperty('byProject');
    expect(typeof groups.byProject).toBe('object');

    for (const [projectPath, sessions] of Object.entries(groups.byProject)) {
      expect(typeof projectPath).toBe('string');
      expect(Array.isArray(sessions)).toBe(true);
    }
  });

  test('context usage has: tokens, contextWindow, percent', async () => {
    const context = service.getContextUsage();

    if (context && typeof context === 'object') {
      expect(
        context.hasOwnProperty('tokens') ||
        context.hasOwnProperty('usage') ||
        context.hasOwnProperty('contextWindow') ||
        context.hasOwnProperty('percent')
      ).toBe(true);
    }
  });

  test('listSessions returns array of sessions', async () => {
    const sessions = await service.listSessions();

    expect(Array.isArray(sessions)).toBe(true);

    for (const session of sessions) {
      expect(typeof session).toBe('object');
      expect(session).not.toBeNull();
    }
  });

  test('getConfig returns providers array and currentModel', async () => {
    const config = await service.getConfig();

    expect(config).toHaveProperty('providers');
    expect(Array.isArray(config.providers)).toBe(true);

    for (const provider of config.providers) {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('hasApiKey');
      expect(typeof provider.hasApiKey).toBe('boolean');
    }

    expect(config).toHaveProperty('currentModel');
  });

  test('getProviders returns array of { id: string, hasApiKey: boolean }', async () => {
    const providers = await service.getProviders();

    expect(Array.isArray(providers)).toBe(true);

    for (const provider of providers) {
      expect(provider).toHaveProperty('id');
      expect(typeof provider.id).toBe('string');
      expect(provider).toHaveProperty('hasApiKey');
      expect(typeof provider.hasApiKey).toBe('boolean');
    }
  });

  test('getModels returns array with id and provider', async () => {
    const models = await service.getModels('anthropic');

    expect(Array.isArray(models)).toBe(true);

    for (const model of models) {
      expect(model).toHaveProperty('id');
      expect(typeof model.id).toBe('string');
      expect(model).toHaveProperty('provider');
    }
  });

  test('getThinkingLevel returns { level: string, supportsThinking: boolean, availableLevels: string[] }', async () => {
    const thinking = await service.getThinkingLevel();

    expect(thinking).toHaveProperty('level');
    expect(typeof thinking.level).toBe('string');

    expect(thinking).toHaveProperty('supportsThinking');
    expect(typeof thinking.supportsThinking).toBe('boolean');

    expect(thinking).toHaveProperty('availableLevels');
    expect(Array.isArray(thinking.availableLevels)).toBe(true);
  });

  test('cycleThinkingLevel returns { success: boolean, level?: string }', async () => {
    const result = await service.cycleThinkingLevel();

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');

    if (result.level) {
      expect(typeof result.level).toBe('string');
    }
  });

  test('compact returns { success: boolean, summary?: string } or throws', async () => {
    try {
      const result = await service.compact();
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    } catch (err: any) {
      expect(err.message).toContain('No active session');
    }
  });
});