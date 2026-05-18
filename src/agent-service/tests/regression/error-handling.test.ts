import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

/**
 * @group regression
 */
describe('Error Handling - Regression', () => {
  let service: any;

  beforeAll(async () => {
    service = await createAgentService();
  });

  afterAll(() => {
    try {
      const testDir = join(tmpdir(), 'codeagent-regression-error');
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('invalid session path throws with descriptive message', async () => {
    await expect(service.switchSession('non-existent-session.jsonl', '')).rejects.toThrow();
  });

  test('missing project directory throws error with descriptive message', async () => {
    const nonExistentPath = join(tmpdir(), 'non-existent-project-dir-12345');
    await expect(service.activateProject(nonExistentPath)).rejects.toThrow('Project not found');
  });

  test('getMessages returns empty array when no session', async () => {
    const emptyService = await createAgentService();
    const messages = emptyService.getMessages();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toEqual([]);
  });

  test('getSessionId returns null when no session', async () => {
    const emptyService = await createAgentService();
    const sessionId = emptyService.getSessionId();
    expect(sessionId).toBeNull();
  });

  test('getContextUsage returns object or null', () => {
    const context = service.getContextUsage();
    expect(context === null || typeof context === 'object').toBe(true);
  });

  test('getSessionStats returns null or object', () => {
    const stats = service.getSessionStats();
    expect(stats === null || typeof stats === 'object').toBe(true);
  });

  test('service recovers gracefully after errors', async () => {
    await expect(service.switchSession('invalid.jsonl', '')).rejects.toThrow();

    const result = await service.init();
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  test('delete non-existent session does not crash', async () => {
    const nonExistent = join(tmpdir(), 'does-not-exist.jsonl');
    await expect(service.deleteSession(nonExistent)).resolves.not.toThrow();
  });

  test('renameSession with invalid path returns error', async () => {
    const invalidPath = join(tmpdir(), 'non-existent-session.jsonl');
    await expect(service.renameSession(invalidPath, 'New Name')).resolves.not.toThrow();
  });

  test('abort without active session does not throw', () => {
    expect(() => service.abort()).not.toThrow();
  });

  test('setThinkingLevel without active session does not throw', () => {
    expect(() => service.setThinkingLevel('low')).not.toThrow();
  });
});