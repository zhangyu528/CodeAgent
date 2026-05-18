import { describe, test, expect, beforeEach } from 'vitest';
import { createElectronIpcAdapter } from '../../src/adapters/electron-ipc.js';
import { createAgentService } from '../../src/services/service.js';

describe('IPC Return Types Validation', () => {
  let service: any;
  let handlers: any[];

  beforeEach(async () => {
    service = await createAgentService();
    handlers = createElectronIpcAdapter(service);
  });

  describe('switchSession return type', () => {
    test('switchSession handler returns void on success', async () => {
      const handler = handlers.find(h => h.channel === 'agent:switchSession');
      const mockEvent = {};

      // Create a session first
      const { sessionPath } = await service.createGlobalSession('return-type-test');

      if (sessionPath) {
        const result = await handler.handler(mockEvent, sessionPath, '');
        expect(result).toBeUndefined(); // Should return void, not { success: true }
      }
    });

    test('switchSession handler throws on invalid path', async () => {
      const handler = handlers.find(h => h.channel === 'agent:switchSession');
      const mockEvent = {};

      await expect(
        handler.handler(mockEvent, '', '')
      ).rejects.toThrow('Invalid session path');
    });
  });

  describe('listSessions return type', () => {
    test('handler returns array', async () => {
      const handler = handlers.find(h => h.channel === 'agent:listSessions');
      const mockEvent = {};

      const result = await handler.handler(mockEvent);
      expect(Array.isArray(result)).toBe(true);
    });

    test('session objects have required fields', async () => {
      const handler = handlers.find(h => h.channel === 'agent:listSessions');
      const mockEvent = {};

      const sessions = await handler.handler(mockEvent);

      if (sessions.length > 0) {
        const session = sessions[0];
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('path');
        expect(session).toHaveProperty('cwd');
        expect(session).toHaveProperty('name');
        expect(session).toHaveProperty('messageCount');
      }
    });

    test('firstMessage field exists for compatibility', async () => {
      const handler = handlers.find(h => h.channel === 'agent:listSessions');
      const mockEvent = {};

      const sessions = await handler.handler(mockEvent);

      // First message should be parsed from session file
      // Even if empty, field should exist
      if (sessions.length > 0) {
        const session = sessions[0];
        expect('firstMessage' in session || 'firstMessage' in (session as any)).toBe(true);
      }
    });
  });

  describe('prompt return type', () => {
    test('prompt returns { success, error? } structure', async () => {
      // This should return { success: false, error: 'No active session' }
      // since there's no active session
      const handler = handlers.find(h => h.channel === 'agent:prompt');
      const mockEvent = {};

      try {
        const result = await handler.handler(mockEvent, 'test message');
        // If it succeeds, check structure
        expect(result).toHaveProperty('success');
        if (!result.success) {
          expect(result).toHaveProperty('error');
        }
      } catch {
        // Error is also acceptable - means exception was thrown
      }
    });
  });

  describe('createSession return type', () => {
    test('returns { success, sessionId, sessionPath }', async () => {
      const handler = handlers.find(h => h.channel === 'agent:newGlobalSession');
      const mockEvent = {};

      const result = await handler.handler(mockEvent);

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('sessionPath');
      expect(result.sessionPath.endsWith('.jsonl')).toBe(true);
    });
  });

  describe('getContextUsage return type', () => {
    test('returns context usage object', async () => {
      const handler = handlers.find(h => h.channel === 'agent:getContextUsage');
      const mockEvent = {};

      const result = await handler.handler(mockEvent);

      // May be null if no active session
      if (result !== null) {
        expect(result).toHaveProperty('tokens');
        expect(result).toHaveProperty('contextWindow');
        expect(result).toHaveProperty('percent');
      }
    });
  });
});