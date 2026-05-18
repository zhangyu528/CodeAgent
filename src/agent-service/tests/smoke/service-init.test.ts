import { describe, test, expect, beforeAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';

/**
 * @group smoke
 */
describe('Service Initialization - Smoke Test', () => {
  let service: any;

  beforeAll(async () => {
    service = await createAgentService();
  });

  test('service initializes without throwing', async () => {
    await expect(createAgentService()).resolves.not.toThrow();
  });

  test('service exposes all required methods', async () => {
    const requiredMethods = [
      'init',
      'hasActiveSession',
      'prompt',
      'getMessages',
      'getSessionId',
      'listSessions',
      'listSessionGroups',
      'createSession',
      'createGlobalSession',
      'createSessionForProject',
      'switchSession',
      'deleteSession',
      'renameSession',
      'listProjects',
      'activateProject',
      'deleteProject',
      'renameProject',
      'getCurrentCwd',
      'getConfig',
      'getProviders',
      'getModels',
      'setModel',
      'saveApiKey',
      'removeApiKey',
      'getContextUsage',
      'compact',
      'setAutoCompaction',
      'getAutoCompaction',
      'isCompacting',
      'getSessionStats',
      'getThinkingLevel',
      'setThinkingLevel',
      'cycleThinkingLevel',
      'abort',
      'isFirstRun',
      'reloadProviders',
      'getAgentHome',
    ];

    for (const method of requiredMethods) {
      expect(typeof service[method]).toBe('function', `Method ${method} should exist`);
    }
  });

  test('service init returns expected structure', async () => {
    const result = await service.init();
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    expect(result).toHaveProperty('sessionId');
    expect(result.sessionId === null || typeof result.sessionId === 'string').toBe(true);
  });

  test('hasActiveSession returns boolean', () => {
    const result = service.hasActiveSession();
    expect(typeof result).toBe('boolean');
  });

  test('getMessages returns array', () => {
    const result = service.getMessages();
    expect(Array.isArray(result)).toBe(true);
  });

  test('getSessionId returns string or null', () => {
    const result = service.getSessionId();
    expect(result === null || typeof result === 'string').toBe(true);
  });
});