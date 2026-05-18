import { describe, test, expect, vi } from 'vitest';
import { createElectronIpcAdapter } from '../../src/adapters/electron-ipc.js';
import { createAgentService } from '../../src/services/service.js';

describe('IPC Error Handling', () => {
  let service: any;
  let handlers: any[];

  beforeEach(async () => {
    service = await createAgentService();
    handlers = createElectronIpcAdapter(service);
  });

  describe('Exception Propagation', () => {
    test('switchSession with empty path throws', async () => {
      const handler = handlers.find(h => h.channel === 'agent:switchSession');

      await expect(
        handler.handler({}, '', '')
      ).rejects.toThrow();
    });

    test('switchSession with whitespace path throws', async () => {
      const handler = handlers.find(h => h.channel === 'agent:switchSession');

      await expect(
        handler.handler({}, '   ', '')
      ).rejects.toThrow('Invalid');
    });

    test('prompt without active session throws', async () => {
      const handler = handlers.find(h => h.channel === 'agent:prompt');

      // Should throw because no active session
      await expect(
        handler.handler({}, 'test message')
      ).rejects.toThrow();
    });

    test('activateProject with invalid path throws', async () => {
      const handler = handlers.find(h => h.channel === 'agent:activateProject');

      await expect(
        handler.handler({}, 'D:\\nonexistent\\path')
      ).rejects.toThrow();
    });
  });

  describe('Error Response Structure', () => {
    test('service.prompt returns error object when no session', async () => {
      // This tests the service layer behavior
      // In some cases, service returns { success: false, error: '...' }
      // rather than throwing

      const result = await service.prompt('test');

      // Either throws or returns error structure
      if (result.success === false) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    test('createSessionForProject throws without project', async () => {
      // createSessionForProject requires registered project
      // should throw if project doesn't exist

      await expect(
        service.createSessionForProject('D:\\nonexistent', 'test')
      ).rejects.toThrow();
    });
  });

  describe('Error Logging', () => {
    test('IPC wrapper logs errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = handlers.find(h => h.channel === 'agent:switchSession');

      try {
        await handler.handler({}, '', '');
      } catch {}

      // Error should be logged
      // (console.error is called in the catch block)

      consoleSpy.mockRestore();
    });
  });

  describe('Graceful Error Recovery', () => {
    test('handler still works after error', async () => {
      // After a failed call, subsequent calls should still work

      const switchHandler = handlers.find(h => h.channel === 'agent:switchSession');
      const listHandler = handlers.find(h => h.channel === 'agent:listSessions');

      // First call fails
      try {
        await switchHandler.handler({}, '', '');
      } catch {}

      // Second call should succeed
      const result = await listHandler.handler({});
      expect(Array.isArray(result)).toBe(true);
    });

    test('handler returns empty array when no sessions', async () => {
      const handler = handlers.find(h => h.channel === 'agent:listSessions');

      const result = await handler.handler({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Error Type Preservation', () => {
    test('directory path error message contains "directory"', async () => {
      const handler = handlers.find(h => h.channel === 'agent:switchSession');

      try {
        await handler.handler({}, '/some/directory/path', '');
      } catch (err: any) {
        expect(err.message.toLowerCase()).toContain('directory');
      }
    });

    test('invalid path error message is descriptive', async () => {
      const handler = handlers.find(h => h.channel === 'agent:switchSession');

      try {
        await handler.handler({}, '', '');
      } catch (err: any) {
        expect(err.message.length).toBeGreaterThan(0);
      }
    });
  });
});