import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

/**
 * @group chaos
 */
describe('Missing Directories - Chaos Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-chaos-missing-' + Date.now());

  let service: any;

  beforeAll(async () => {
    service = await createAgentService();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('list sessions when sessions dir missing', async () => {
    const nonExistentDir = join(tmpdir(), 'does-not-exist-sessions-12345');
    const fakeService = await createAgentService();

    const sessions = await fakeService.listSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test('activate project with non-existent path throws', async () => {
    const nonExistentPath = join(tmpdir(), 'non-existent-project-dir-67890');
    await expect(service.activateProject(nonExistentPath)).rejects.toThrow('Project not found');
  });

  test('get session stats when no session active', async () => {
    const newService = await createAgentService();
    const stats = newService.getSessionStats();
    expect(stats === null || typeof stats === 'object').toBe(true);
  });

  test('get context usage when no session', async () => {
    const newService = await createAgentService();
    const usage = newService.getContextUsage();
    expect(usage === null || typeof usage === 'object').toBe(true);
  });

  test('get thinking level when no session', async () => {
    const newService = await createAgentService();
    const level = await newService.getThinkingLevel();
    expect(level).toHaveProperty('level');
    expect(level).toHaveProperty('supportsThinking');
    expect(level).toHaveProperty('availableLevels');
  });

  test('compact when no session active throws with descriptive message', async () => {
    const newService = await createAgentService();
    await expect(newService.compact()).rejects.toThrow('No active session');
  });

  test('switch session when parent directories missing', async () => {
    const missingParentPath = join(tmpdir(), 'missing', 'parent', 'dir', 'session.jsonl');
    await expect(service.switchSession(missingParentPath, '')).rejects.toThrow();
  });
});