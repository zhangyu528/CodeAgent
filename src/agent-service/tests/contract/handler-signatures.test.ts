import { describe, test, expect, beforeEach } from 'vitest';
import { createElectronIpcAdapter } from '../../src/adapters/electron-ipc.js';
import { createAgentService } from '../../src/services/service.js';

/**
 * @group contract
 */
describe('Handler Signatures - Contract Test', () => {
  let service: any;
  let handlers: any[];

  beforeEach(async () => {
    service = await createAgentService();
    handlers = createElectronIpcAdapter(service);
  });

  test('agent:init returns { success: boolean, sessionId: string | null }', async () => {
    const handler = handlers.find(h => h.channel === 'agent:init');
    const result = await handler.handler({});

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    expect(result).toHaveProperty('sessionId');
    expect(result.sessionId === null || typeof result.sessionId === 'string').toBe(true);
  });

  test('agent:getMessages returns array', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getMessages');
    const result = await handler.handler({});

    expect(Array.isArray(result)).toBe(true);
  });

  test('agent:listSessions returns array', async () => {
    const handler = handlers.find(h => h.channel === 'agent:listSessions');
    const result = await handler.handler({});

    expect(Array.isArray(result)).toBe(true);
  });

  test('agent:listSessionGroups returns { global: [], byProject: {} }', async () => {
    const handler = handlers.find(h => h.channel === 'agent:listSessionGroups');
    const result = await handler.handler({});

    expect(result).toHaveProperty('global');
    expect(Array.isArray(result.global)).toBe(true);
    expect(result).toHaveProperty('byProject');
    expect(typeof result.byProject).toBe('object');
  });

  test('agent:getContextUsage returns object or null', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getContextUsage');
    const result = await handler.handler({});

    expect(result === null || typeof result === 'object').toBe(true);
  });

  test('agent:getSessionStats returns object or null', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getSessionStats');
    const result = await handler.handler({});

    expect(result === null || typeof result === 'object').toBe(true);
  });

  test('agent:getThinkingLevel returns { level, supportsThinking, availableLevels }', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getThinkingLevel');
    const result = await handler.handler({});

    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('supportsThinking');
    expect(result).toHaveProperty('availableLevels');
    expect(Array.isArray(result.availableLevels)).toBe(true);
  });

  test('agent:cycleThinkingLevel returns { success: boolean }', async () => {
    const handler = handlers.find(h => h.channel === 'agent:cycleThinkingLevel');
    const result = await handler.handler({});

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  test('agent:getAutoCompaction returns boolean', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getAutoCompaction');
    const result = await handler.handler({});

    expect(typeof result).toBe('boolean');
  });

  test('agent:isCompacting returns boolean', async () => {
    const handler = handlers.find(h => h.channel === 'agent:isCompacting');
    const result = await handler.handler({});

    expect(typeof result).toBe('boolean');
  });

  test('agent:hasActiveSession returns boolean', async () => {
    const handler = handlers.find(h => h.channel === 'agent:hasActiveSession');
    const result = await handler.handler({});

    expect(typeof result).toBe('boolean');
  });

  test('agent:getSessionId returns string or null', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getSessionId');
    const result = await handler.handler({});

    expect(result === null || typeof result === 'string').toBe(true);
  });

  test('agent:abort handler is callable without throwing', async () => {
    const handler = handlers.find(h => h.channel === 'agent:abort');
    expect(handler).toBeDefined();

    await expect(handler.handler({})).resolves.not.toThrow();
  });

  test('agent:getCurrentCwd handler is callable', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getCurrentCwd');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(typeof result).toBe('string');
  });

  test('agent:listProjects handler is callable', async () => {
    const handler = handlers.find(h => h.channel === 'agent:listProjects');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(Array.isArray(result)).toBe(true);
  });

  test('agent:getConfig handler is callable', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getConfig');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(result).toHaveProperty('providers');
    expect(result).toHaveProperty('currentModel');
  });

  test('agent:getProviders handler is callable', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getProviders');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(Array.isArray(result)).toBe(true);
  });

  test('agent:isFirstRun handler is callable', async () => {
    const handler = handlers.find(h => h.channel === 'agent:isFirstRun');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(typeof result).toBe('boolean');
  });

  test('agent:reloadProviders returns { success: boolean, providers?: string[] }', async () => {
    const handler = handlers.find(h => h.channel === 'agent:reloadProviders');
    const result = await handler.handler({});

    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    if (result.providers) {
      expect(Array.isArray(result.providers)).toBe(true);
    }
  });
});