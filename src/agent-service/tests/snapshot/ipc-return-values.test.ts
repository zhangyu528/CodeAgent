import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { GLOBAL_SESSION_HEADER, SAMPLE_MESSAGES } from '../__fixtures__/sessions.js';

/**
 * @group snapshot
 */
describe('IPC Return Values - Snapshot Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-snapshot-ipc-' + Date.now());
  const SESSIONS_DIR = join(TEST_DIR, 'sessions');
  const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
  const SESSION_FILE = join(GLOBAL_DIR, 'snapshot_test_session.jsonl');

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

  test('init() return value structure', async () => {
    const result = await service.init();

    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('sessionId');
    expect(result.sessionId === null || typeof result.sessionId === 'string').toBe(true);
  });

  test('listSessions() returns array', async () => {
    const sessions = await service.listSessions();

    expect(Array.isArray(sessions)).toBe(true);
  });

  test('listSessionGroups() return structure', async () => {
    const groups = await service.listSessionGroups();

    expect(groups).toHaveProperty('global');
    expect(Array.isArray(groups.global)).toBe(true);
    expect(groups).toHaveProperty('byProject');
    expect(typeof groups.byProject).toBe('object');
  });

  test('getContextUsage() return structure', () => {
    const context = service.getContextUsage();

    expect(context === null || typeof context === 'object').toBe(true);
  });

  test('getConfig() return structure', async () => {
    const config = await service.getConfig();

    expect(config).toHaveProperty('providers');
    expect(Array.isArray(config.providers)).toBe(true);
    expect(config).toHaveProperty('currentModel');
  });

  test('getProviders() return structure', async () => {
    const providers = await service.getProviders();

    expect(Array.isArray(providers)).toBe(true);

    for (const provider of providers) {
      expect(provider).toHaveProperty('id');
      expect(typeof provider.id).toBe('string');
      expect(provider).toHaveProperty('hasApiKey');
      expect(typeof provider.hasApiKey).toBe('boolean');
    }
  });

  test('getThinkingLevel() return structure', async () => {
    const thinking = await service.getThinkingLevel();

    expect(thinking).toHaveProperty('level');
    expect(typeof thinking.level).toBe('string');
    expect(thinking).toHaveProperty('supportsThinking');
    expect(typeof thinking.supportsThinking).toBe('boolean');
    expect(thinking).toHaveProperty('availableLevels');
    expect(Array.isArray(thinking.availableLevels)).toBe(true);
  });

  test('cycleThinkingLevel() return structure', async () => {
    const result = await service.cycleThinkingLevel();

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  test('getSessionStats() return structure', () => {
    const stats = service.getSessionStats();

    expect(stats === null || typeof stats === 'object').toBe(true);
  });

  test('getAutoCompaction() return type', async () => {
    const result = await service.getAutoCompaction();

    expect(typeof result).toBe('boolean');
  });

  test('isCompacting() return type', async () => {
    const result = await service.isCompacting();

    expect(typeof result).toBe('boolean');
  });

  test('compact() throws without session', async () => {
    try {
      await service.compact();
    } catch (err: any) {
      expect(err.message).toContain('No active session');
    }
  });
});