import { describe, test, expect } from 'vitest';
import { createElectronIpcAdapter } from '../../src/adapters/electron-ipc.js';
import { createAgentService } from '../../src/services/service.js';

describe('IPC All Channels Coverage', () => {
  let service: any;
  let handlers: any[];

  // All expected IPC channels
  const expectedChannels = [
    // Session
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
    // Project
    'agent:listProjects',
    'agent:activateProject',
    'agent:deleteProject',
    'agent:renameProject',
    'agent:getCurrentCwd',
    // Model
    'agent:getConfig',
    'agent:getProviders',
    'agent:getModels',
    'agent:setModel',
    'agent:saveApiKey',
    'agent:removeApiKey',
    'agent:isFirstRun',
    'agent:reloadProviders',
    // Context
    'agent:getContextUsage',
    'agent:compact',
    'agent:setAutoCompaction',
    'agent:getAutoCompaction',
    'agent:isCompacting',
    // Stats
    'agent:getSessionStats',
    'agent:getThinkingLevel',
    'agent:setThinkingLevel',
    'agent:cycleThinkingLevel',
    // Control
    'agent:abort',
    // Platform
    'agent:getAgentHome',
  ];

  beforeEach(async () => {
    service = await createAgentService();
    handlers = createElectronIpcAdapter(service);
  });

  describe('Handler Registration', () => {
    test('all expected channels have handlers', () => {
      const registeredChannels = handlers.map(h => h.channel);

      const missingChannels = expectedChannels.filter(
        ch => !registeredChannels.includes(ch)
      );

      expect(missingChannels).toEqual([]);
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
  });

  describe('Handler Callable Tests', () => {
    test('init handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:init');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(result).toHaveProperty('success');
    });

    test('getMessages handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getMessages');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('getSessionId handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getSessionId');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      // Should be string or null
      expect(result === null || typeof result === 'string').toBe(true);
    });

    test('hasActiveSession handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:hasActiveSession');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(typeof result).toBe('boolean');
    });

    test('getCurrentCwd handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getCurrentCwd');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(typeof result).toBe('string');
    });

    test('listProjects handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:listProjects');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('getConfig handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getConfig');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('currentModel');
    });

    test('getProviders handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getProviders');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('isFirstRun handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:isFirstRun');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(typeof result).toBe('boolean');
    });

    test('getContextUsage handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getContextUsage');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      // May be null if no session
      expect(result === null || typeof result === 'object').toBe(true);
    });

    test('getAutoCompaction handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getAutoCompaction');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(typeof result).toBe('boolean');
    });

    test('isCompacting handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:isCompacting');
      expect(handler).toBeDefined();

      const result = await handler.handler({});
      expect(typeof result).toBe('boolean');
    });

    test('abort handler is callable', async () => {
      const handler = handlers.find(h => h.channel === 'agent:abort');
      expect(handler).toBeDefined();

      // Should not throw
      await expect(handler.handler({})).resolves.not.toThrow();
    });
  });

  describe('Channel Handler Count', () => {
    test('handler count matches expected', () => {
      // We expect at least 30+ handlers
      expect(handlers.length).toBeGreaterThanOrEqual(30);
    });
  });
});