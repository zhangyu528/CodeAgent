import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

/**
 * @group performance
 */
describe('Concurrent Sessions - Performance Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-perf-concurrent-' + Date.now());

  let service: any;

  beforeAll(async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    service = await createAgentService();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('create 5 sessions concurrently < 500ms each', async () => {
    const start = Date.now();

    const promises = [
      service.createGlobalSession('perf-concurrent-1'),
      service.createGlobalSession('perf-concurrent-2'),
      service.createGlobalSession('perf-concurrent-3'),
      service.createGlobalSession('perf-concurrent-4'),
      service.createGlobalSession('perf-concurrent-5'),
    ];

    const results = await Promise.all(promises);

    const elapsed = Date.now() - start;
    const perSession = elapsed / 5;

    expect(results).toHaveLength(5);
    expect(perSession).toBeLessThan(500);
  });

  test('list sessions with 10+ sessions < 100ms', async () => {
    for (let i = 0; i < 10; i++) {
      await service.createGlobalSession('perf-list-' + i);
    }

    const start = Date.now();
    const sessions = await service.listSessions();
    const elapsed = Date.now() - start;

    expect(sessions.length).toBeGreaterThanOrEqual(10);
    expect(elapsed).toBeLessThan(100);
  });

  test('switch session multiple times rapidly', async () => {
    const sessions = [];
    for (let i = 0; i < 5; i++) {
      const result = await service.createGlobalSession('perf-switch-' + i);
      sessions.push(result.sessionPath);
    }

    const start = Date.now();
    for (const path of sessions) {
      await service.switchSession(path, '');
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  test('init service completes quickly', async () => {
    const start = Date.now();
    const newService = await createAgentService();
    await newService.init();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  test('listSessionGroups completes < 100ms', async () => {
    for (let i = 0; i < 5; i++) {
      await service.createGlobalSession('perf-groups-' + i);
    }

    const start = Date.now();
    await service.listSessionGroups();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});