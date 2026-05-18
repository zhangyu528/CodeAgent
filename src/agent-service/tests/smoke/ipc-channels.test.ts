import { describe, test, expect, beforeEach } from 'vitest';
import { createElectronIpcAdapter } from '../../src/adapters/electron-ipc.js';
import { createAgentService } from '../../src/services/service.js';

/**
 * @group smoke
 */
describe('IPC Channels - Smoke Test', () => {
  let service: any;
  let handlers: any[];

  beforeEach(async () => {
    service = await createAgentService();
    handlers = createElectronIpcAdapter(service);
  });

  test('all expected IPC channels are registered', () => {
    const expectedChannels = [
      'agent:init',
      'agent:hasActiveSession',
      'agent:prompt',
      'agent:getMessages',
      'agent:getSessionId',
      'agent:listSessions',
      'agent:listSessionGroups',
      'agent:newSession',
      'agent:newGlobalSession',
      'agent:newSessionForProject',
      'agent:switchSession',
      'agent:deleteSession',
      'agent:renameSession',
      'agent:listProjects',
      'agent:activateProject',
      'agent:deleteProject',
      'agent:renameProject',
      'agent:getCurrentCwd',
      'agent:getConfig',
      'agent:getProviders',
      'agent:getModels',
      'agent:setModel',
      'agent:saveApiKey',
      'agent:removeApiKey',
      'agent:isFirstRun',
      'agent:reloadProviders',
      'agent:getContextUsage',
      'agent:compact',
      'agent:setAutoCompaction',
      'agent:getAutoCompaction',
      'agent:isCompacting',
      'agent:getSessionStats',
      'agent:getThinkingLevel',
      'agent:setThinkingLevel',
      'agent:cycleThinkingLevel',
      'agent:abort',
    ];

    const registeredChannels = handlers.map(h => h.channel);

    for (const channel of expectedChannels) {
      expect(registeredChannels).toContain(channel, `Channel ${channel} should be registered`);
    }
  });

  test('handler count is at least 30', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(30);
  });

  test('no duplicate channel registrations', () => {
    const channelCounts = new Map<string, number>();

    handlers.forEach(h => {
      channelCounts.set(h.channel, (channelCounts.get(h.channel) || 0) + 1);
    });

    const duplicates = Array.from(channelCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([ch]) => ch);

    expect(duplicates).toEqual([]);
  });

  test('init handler is callable and returns success', async () => {
    const handler = handlers.find(h => h.channel === 'agent:init');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
  });

  test('getMessages handler is callable and returns array', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getMessages');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(Array.isArray(result)).toBe(true);
  });

  test('getSessionId handler is callable', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getSessionId');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(result === null || typeof result === 'string').toBe(true);
  });

  test('hasActiveSession handler is callable and returns boolean', async () => {
    const handler = handlers.find(h => h.channel === 'agent:hasActiveSession');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(typeof result).toBe('boolean');
  });

  test('getCurrentCwd handler is callable and returns string', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getCurrentCwd');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(typeof result).toBe('string');
  });

  test('getProviders handler is callable and returns array', async () => {
    const handler = handlers.find(h => h.channel === 'agent:getProviders');
    expect(handler).toBeDefined();

    const result = await handler.handler({});
    expect(Array.isArray(result)).toBe(true);
  });

  test('abort handler is callable without throwing', async () => {
    const handler = handlers.find(h => h.channel === 'agent:abort');
    expect(handler).toBeDefined();

    await expect(handler.handler({})).resolves.not.toThrow();
  });
});