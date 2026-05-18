import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createAgentService } from '../../src/services/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { GLOBAL_SESSION_HEADER } from '../__fixtures__/sessions.js';

/**
 * @group chaos
 */
describe('Corrupted Session - Chaos Test', () => {
  const TEST_DIR = join(tmpdir(), 'codeagent-chaos-session-' + Date.now());
  const SESSIONS_DIR = join(TEST_DIR, 'sessions');
  const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');

  let service: any;

  beforeAll(async () => {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    service = await createAgentService();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('invalid JSON in session file does not crash service', async () => {
    const corruptedFile = join(GLOBAL_DIR, 'corrupted.jsonl');
    writeFileSync(corruptedFile, 'not valid json{}\n');

    try {
      await service.switchSession(corruptedFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('session file with missing required header fields is handled', async () => {
    const incompleteHeaderFile = join(GLOBAL_DIR, 'incomplete.jsonl');
    const incompleteHeader = { id: 'test' };
    writeFileSync(incompleteHeaderFile, JSON.stringify(incompleteHeader) + '\n');

    try {
      await service.switchSession(incompleteHeaderFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('session file with malformed message content is handled', async () => {
    const malformedFile = join(GLOBAL_DIR, 'malformed.jsonl');
    const header = { ...GLOBAL_SESSION_HEADER, id: 'malformed-test' };
    writeFileSync(malformedFile, JSON.stringify(header) + '\n');
    writeFileSync(malformedFile, '{"role": "user", invalid json}\n', { flag: 'a' });

    try {
      await service.switchSession(malformedFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('empty session file is handled', async () => {
    const emptyFile = join(GLOBAL_DIR, 'empty.jsonl');
    writeFileSync(emptyFile, '');

    try {
      await service.switchSession(emptyFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('session file with only newlines is handled', async () => {
    const newlineFile = join(GLOBAL_DIR, 'newlines.jsonl');
    writeFileSync(newlineFile, '\n\n\n');

    try {
      await service.switchSession(newlineFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('session file with valid header but no messages', async () => {
    const noMessagesFile = join(GLOBAL_DIR, 'no-messages.jsonl');
    writeFileSync(noMessagesFile, JSON.stringify(GLOBAL_SESSION_HEADER) + '\n');

    await expect(service.switchSession(noMessagesFile, '')).resolves.not.toThrow();
  });

  test('session file with wrong type field is handled', async () => {
    const wrongTypeFile = join(GLOBAL_DIR, 'wrong-type.jsonl');
    const wrongType = { ...GLOBAL_SESSION_HEADER, type: 'not-session' };
    writeFileSync(wrongTypeFile, JSON.stringify(wrongType) + '\n');

    // Session system may reject or accept this - just ensure no crash
    try {
      await service.switchSession(wrongTypeFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('session file with negative version is handled', async () => {
    const negVersionFile = join(GLOBAL_DIR, 'neg-version.jsonl');
    const negVersion = { ...GLOBAL_SESSION_HEADER, version: -1 };
    writeFileSync(negVersionFile, JSON.stringify(negVersion) + '\n');

    try {
      await service.switchSession(negVersionFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });

  test('session file with missing id field is handled', async () => {
    const noIdFile = join(GLOBAL_DIR, 'no-id.jsonl');
    const noId = { type: 'session', version: 2, timestamp: Date.now() };
    writeFileSync(noIdFile, JSON.stringify(noId) + '\n');

    try {
      await service.switchSession(noIdFile, '');
    } catch (err: any) {
      expect(err.message).toBeTruthy();
    }
  });
});