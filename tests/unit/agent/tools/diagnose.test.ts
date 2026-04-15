/**
 * Diagnostic test to understand why npm run build fails
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}));

import { runCommandTool } from '../../../../src/agent/tools/run_command';
import { classifyCommand } from '../../../../src/agent/tools/sandbox/command-tiers';
import { PermissionLedger } from '../../../../src/agent/tools/sandbox/permission-ledger';

describe('DEBUG: npm run build failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any env that might affect tests
    delete process.env.CODEAGENT_WORKSPACE_ROOT;
  });

  it('DEBUG: classify npm run build', () => {
    const tier = classifyCommand('npm run build');
    console.log('tier for npm run build:', tier);
    expect(tier).toBe('safe');
  });

  it('DEBUG: PermissionLedger.has for npm run build', () => {
    const ledger = new PermissionLedger();
    const tier = classifyCommand('npm run build');
    const result = ledger.has('npm run build', tier);
    console.log('PermissionLedger.has("npm run build", "safe"):', result);
    expect(result).toBe(true);
  });

  it('DEBUG: run npm run build', async () => {
    const { execFile } = await import('child_process');
    (execFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ stdout: 'build output\n', stderr: '' });
    
    const result = await runCommandTool.execute('test-id', { command: 'npm run build' });
    console.log('result.details:', result.details);
    console.log('result.content:', result.content[0]?.text?.substring(0, 200));
    expect(result.details.success).toBe(true);
  });
});
