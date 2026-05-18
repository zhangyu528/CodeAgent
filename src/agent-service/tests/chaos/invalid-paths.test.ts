import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

/**
 * @group chaos
 */
describe('Invalid Paths - Chaos Test', () => {
  let service: any;

  beforeAll(async () => {
    service = await createAgentService();
  });

  afterAll(() => {
    try {
      const testDir = join(tmpdir(), 'codeagent-chaos-paths');
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('switch to non-existent session path', async () => {
    const nonExistent = join(tmpdir(), 'this-session-does-not-exist-12345.jsonl');
    await expect(service.switchSession(nonExistent, '')).rejects.toThrow();
  });

  test('switch to directory instead of file', async () => {
    const testDir = join(tmpdir(), 'codeagent-test-dir-chaos');
    mkdirSync(testDir, { recursive: true });

    await expect(service.switchSession(testDir, '')).rejects.toThrow();
  });

  test('delete non-existent session', async () => {
    const nonExistent = join(tmpdir(), 'non-existent-delete-12345.jsonl');
    await expect(service.deleteSession(nonExistent)).resolves.not.toThrow();
  });

  test('rename non-existent session', async () => {
    const nonExistent = join(tmpdir(), 'non-existent-rename-12345.jsonl');
    await expect(service.renameSession(nonExistent, 'New Name')).resolves.not.toThrow();
  });

  test('switch with path containing null bytes', async () => {
    const nullPath = '/path/with\0/null/bytes.jsonl';
    await expect(service.switchSession(nullPath, '')).rejects.toThrow();
  });

  test('switch with extremely long path', async () => {
    const longPath = 'a'.repeat(1000) + '.jsonl';
    await expect(service.switchSession(longPath, '')).rejects.toThrow();
  });

  test('switch with special characters in path', async () => {
    const specialPath = '/path/with<>:"/\\|?*chars.jsonl';
    await expect(service.switchSession(specialPath, '')).rejects.toThrow();
  });

  test('activate project with invalid path characters throws', async () => {
    const invalidPath = '/invalid/path/with<>:"chars';
    await expect(service.activateProject(invalidPath)).rejects.toThrow('Project not found');
  });

  test('rename project with empty new name', async () => {
    const existingPath = join(tmpdir(), 'existing-project');
    mkdirSync(existingPath, { recursive: true });
    await expect(service.renameProject(existingPath, '')).resolves.not.toThrow();
  });
});