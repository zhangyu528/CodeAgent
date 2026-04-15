/**
 * Integration tests for sandbox module with run_command tool.
 * 
 * Tests the integration between sandbox components and the run_command tool
 * without depending on the existing run_command.test.ts (which has vi.hoisted issues).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock child_process before importing run_command
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}));

import { runCommandTool } from '../run_command.js';
import { PermissionLedger } from './permission-ledger.js';
import { classifyCommand } from './command-tiers.js';
import { getWorkspaceRoot, validateCommandPaths } from './workspace.js';

describe('Sandbox Integration: run_command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset CODEAGENT_WORKSPACE_ROOT between tests
    delete process.env.CODEAGENT_WORKSPACE_ROOT;
  });

  afterEach(() => {
    delete process.env.CODEAGENT_WORKSPACE_ROOT;
  });

  // ─── Workspace Root Validation ──────────────────────────────────────────────

  describe('workspace root validation', () => {
    it('rejects command with absolute path outside workspace', async () => {
      process.env.CODEAGENT_WORKSPACE_ROOT = '/tmp/sandbox';

      const result = await runCommandTool.execute('call-1', { command: 'cat /etc/passwd' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('path_outside_workspace');
    });

    it('allows command with no paths when workspace is set', async () => {
      process.env.CODEAGENT_WORKSPACE_ROOT = '/tmp/sandbox';

      const { execFile } = await import('child_process');
      (execFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ stdout: 'ok\n', stderr: '' });

      const result = await runCommandTool.execute('call-1', { command: 'ls' });
      expect(result.details.success).toBe(true);
    });

    it('uses process.cwd() when workspace is not set', async () => {
      delete process.env.CODEAGENT_WORKSPACE_ROOT;
      const cwd = process.cwd();

      const { execFile } = await import('child_process');
      (execFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ stdout: 'ok\n', stderr: '' });

      // This should work since ls with no absolute paths is fine
      const result = await runCommandTool.execute('call-1', { command: 'ls' });
      expect(result.details.success).toBe(true);
    });
  });

  // ─── Command Tier Classification ─────────────────────────────────────────────

  describe('command tier classification', () => {
    it('classifies safe commands correctly', () => {
      expect(classifyCommand('ls')).toBe('safe');
      expect(classifyCommand('cat')).toBe('safe');
      expect(classifyCommand('git status')).toBe('safe');
    });

    it('classifies elevated commands correctly', () => {
      expect(classifyCommand('git push')).toBe('elevated');
      expect(classifyCommand('npm install')).toBe('elevated');
    });

    it('classifies dangerous commands correctly', () => {
      expect(classifyCommand('rm -rf /')).toBe('dangerous');
      expect(classifyCommand('dd if=/dev/zero')).toBe('dangerous');
    });
  });

  // ─── Permission Ledger Integration ──────────────────────────────────────────

  describe('permission ledger', () => {
    it('safe tier commands do not need ledger approval', () => {
      const ledger = new PermissionLedger();
      expect(ledger.has('ls', 'safe')).toBe(true);
      expect(ledger.has('cat', 'safe')).toBe(true);
    });

    it('elevated tier commands need ledger approval', () => {
      const ledger = new PermissionLedger();
      expect(ledger.has('git push', 'elevated')).toBe(false);

      ledger.approve('git push', 'elevated');
      expect(ledger.has('git push', 'elevated')).toBe(true);
    });

    it('session ends clears ledger', () => {
      const ledger = new PermissionLedger();
      ledger.approve('git push', 'elevated');
      ledger.approve('npm install', 'elevated');

      ledger.clear();

      expect(ledger.has('git push', 'elevated')).toBe(false);
      expect(ledger.has('npm install', 'elevated')).toBe(false);
    });
  });
});
