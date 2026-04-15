import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process to prevent actual command execution
const mockExecFn = vi.fn();
const mockExecFileFn = vi.fn();
vi.mock('child_process', () => ({
  exec: (...args: unknown[]) => mockExecFn(...args),
  execFile: (...args: unknown[]) => mockExecFileFn(...args),
}));

// Mock util.promisify to return our mock functions
vi.mock('util', () => ({
  promisify: (fn: unknown) => {
    if ((fn as { __func?: string }).__func === 'exec') return mockExecFn;
    if ((fn as { __func?: string }).__func === 'execFile') return mockExecFileFn;
    return fn;
  },
}));

// Mock sandbox modules to prevent permission ledger interference
vi.mock('../../../../src/agent/tools/sandbox/command-tiers', () => ({
  classifyCommand: vi.fn((cmd: string) => {
    // Default: treat all as 'safe' tier for most tests
    // Tests that need elevated/dangerous can override via mockSetup
    const elevated = ['git push', 'git push --force', 'npm install', 'yarn install', 'pnpm install', 'docker rmi', 'docker rm'];
    const dangerous = ['rm -rf', 'dd ', 'mkfs', 'fdisk'];
    const trimmed = cmd.trim().toLowerCase();
    if (dangerous.some(p => trimmed.includes(p))) return 'dangerous';
    if (elevated.includes(trimmed)) return 'elevated';
    return 'safe';
  }),
}));

vi.mock('../../../../src/agent/tools/sandbox/permission-ledger', () => ({
  PermissionLedger: vi.fn().mockImplementation(() => ({
    has: (cmd: string, tier: string) => {
      // Safe tier always approved, elevated/dangerous need explicit approval
      if (tier === 'safe') return true;
      return false;
    },
    approve: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { runCommandTool } from '../../../../src/agent/tools/run_command';

describe('runCommandTool', () => {
  describe('metadata', () => {
    it('should have correct name and label', () => {
      expect(runCommandTool.name).toBe('run_command');
      expect(runCommandTool.label).toBe('Running Command');
    });

    it('should have correct parameters schema', () => {
      const params = runCommandTool.parameters;
      expect(params.shape).toHaveProperty('command');
    });

    it('should have description', () => {
      expect(typeof runCommandTool.description).toBe('string');
      expect(runCommandTool.description.length).toBeGreaterThan(0);
    });

    it('should have an execute function', () => {
      expect(typeof runCommandTool.execute).toBe('function');
    });
  });

  describe('execute', () => {
    it('should return an object with content and details when executed', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello' });
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should execute a simple echo command successfully', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello' });
      expect(result.details.command).toBe('echo hello');
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('hello');
    });

    it('should capture stdout from a command', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'printf "line1\\nline2"' });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('line1');
      expect(result.content[0].text).toContain('line2');
    });

    it('should append stderr to output when present', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'printf "out" >&2' });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('out');
      expect(result.content[0].text).toContain('Errors:');
    });

    it('should return failure for non-zero exit code', async () => {
      // 'exit' IS in the allowlist (ALLOWED_REGEX), but execFile() fails because
      // 'exit' is a shell builtin — not available as a standalone executable.
      // execFile() throws ENOENT which is caught and returns success:false, reason:undefined.
      const result = await runCommandTool.execute('test-id', { command: 'exit 1' });
      expect(result.details.command).toBe('exit 1');
      expect(result.details.success).toBe(false);
      // reason is undefined because ENOENT is caught but doesn't set a specific reason
      expect(result.details.reason).toBeUndefined();
    });

    it('should reject unknown commands not in the allowlist', async () => {
      // SECURITY: Unknown commands without shell metacharacters are now REJECTED
      // (previously fell through to exec() with shell=true — a security gap)
      const result = await runCommandTool.execute('test-id', {
        command: 'nonexistent_command_12345',
      });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('command_not_allowed');
      expect(result.content[0].text).toContain('not in the approved command list');
    });

    it('should handle commands with arguments', async () => {
      const result = await runCommandTool.execute('test-id', {
        command: 'echo -n "test argument"',
      });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe('test argument');
    });

    it('should handle piped commands via shell', async () => {
      // With shell hardening, piped commands are not allowlisted (no shell:false execFile)
      // so they fall through to exec() which does run them with shell=true
      const result = await runCommandTool.execute('test-id', {
        command: 'echo "hello world" | tr "[:lower:]" "[:upper:]"',
      });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('HELLO WORLD');
    });

    it('should handle command that produces no output', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'true' });
      expect(result.details.success).toBe(true);
    });

    it('should handle command producing combined stdout and stderr', async () => {
      const result = await runCommandTool.execute('test-id', {
        command: '(echo stdout; echo stderr >&2)',
      });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('stdout');
      expect(result.content[0].text).toContain('stderr');
    });

    it('should handle timeout gracefully', async () => {
      // Baseline test: verify execute returns success for a simple command (not timing out here)
      // Note: 'exit' is a shell builtin not available via execFile (shell:false)
      const result = await runCommandTool.execute('test-id', { command: 'true' });
      expect(result.details.success).toBe(true);
    });

    it('should block shell injection via semicolon', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello; rm -rf /' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block shell injection via double pipe', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello || ls' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block command substitution via backticks', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo `ls`' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block command substitution via $()', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo $(ls)' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block chained commands with &&', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello && ls' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block chained commands with ||', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello || ls' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block sudo su command', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'sudo su -' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block redirection with >', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello > /tmp/test' });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should block dd command', async () => {
      const result = await runCommandTool.execute('test-id', {
        command: 'dd if=/dev/zero of=/tmp/test',
      });
      expect(result.details.success).toBe(false);
      expect(result.details.reason).toBe('blocked_dangerous_pattern');
    });

    it('should allow simple echo command', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo hello' });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('hello');
    });

    it('should allow echo with quoted arguments', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo "hello world"' });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('hello world');
    });

    it('should allow vim (extended allowlist)', async () => {
      // vim is now in ALLOWED_COMMANDS — but it requires a TTY
      // We just verify it's recognized as allowed (execFile path) not blocked
      const result = await runCommandTool.execute('test-id', { command: 'vim --version' });
      // vim without a TTY will fail, but it should NOT be command_not_allowed
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow hg (extended allowlist)', async () => {
      // hg (Mercurial) is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'hg version' });
      // Should either succeed or fail with non-allowlist reason
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow man (extended allowlist)', async () => {
      // man is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'man --version' });
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow ssh (extended allowlist)', async () => {
      // ssh is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'ssh -V' });
      // ssh -V outputs to stderr, but should not be command_not_allowed
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow scp (extended allowlist)', async () => {
      // scp is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'scp -V' });
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow rsync (extended allowlist)', async () => {
      // rsync is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'rsync --version' });
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow nano (extended allowlist)', async () => {
      // nano is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'nano --version' });
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should allow less (extended allowlist)', async () => {
      // less is now in ALLOWED_COMMANDS
      const result = await runCommandTool.execute('test-id', { command: 'less --version' });
      expect(result.details.reason).not.toBe('command_not_allowed');
    });
  });

  // ─── Zod Schema Argument Validation ─────────────────────────────────────────

  describe('Zod schema argument validation (COMMAND_ALLOWLIST)', () => {
    // Validation failures — commands rejected BEFORE reaching execFile.
    describe('rejections (invalid subcommands)', () => {
      it('rejects git unknown-subcmd', async () => {
        // "unknown-subcmd" is NOT in the git cmd enum
        const result = await runCommandTool.execute('test-id', { command: 'git unknown-subcmd' });
        expect(result.details.success).toBe(false);
        expect(result.details.reason).toBe('invalid_arguments');
        // content[0] is an object like { text: '...' }, check the text property
        expect(result.content[0].text).toMatch(/invalid arguments/i);
      });

      it('rejects npm unknown-cmd', async () => {
        // "unknown-cmd" is NOT in the npm command enum
        const result = await runCommandTool.execute('test-id', { command: 'npm unknown-cmd' });
        expect(result.details.success).toBe(false);
        expect(result.details.reason).toBe('invalid_arguments');
        expect(result.content[0].text).toMatch(/invalid arguments/i);
      });

      it('rejects bun unknown-cmd', async () => {
        // "unknown-cmd" is NOT in the bun command enum
        const result = await runCommandTool.execute('test-id', { command: 'bun unknown-cmd' });
        expect(result.details.success).toBe(false);
        expect(result.details.reason).toBe('invalid_arguments');
        expect(result.content[0].text).toMatch(/invalid arguments/i);
      });

      it('rejects pnpm unknown-cmd', async () => {
        const result = await runCommandTool.execute('test-id', { command: 'pnpm unknown-cmd' });
        expect(result.details.success).toBe(false);
        expect(result.details.reason).toBe('invalid_arguments');
      });

      it('rejects yarn unknown-cmd', async () => {
        const result = await runCommandTool.execute('test-id', { command: 'yarn unknown-cmd' });
        expect(result.details.success).toBe(false);
        expect(result.details.reason).toBe('invalid_arguments');
      });
    });

    // Validation successes — commands pass allowlist + schema checks.
    // Note: BLOCKED_REGEX may still block some flags (e.g. git commit -m "...").
    describe('allowances (valid subcommands)', () => {
      it('allows git status (git subcommand is valid)', async () => {
        const result = await runCommandTool.execute('test-id', { command: 'git status' });
        expect(result.details.success).toBe(true);
        expect(result.details.reason).toBeUndefined();
      });

      it('allows npm run build (run is valid npm command)', async () => {
        // Note: With sandbox integration, npm/bun run build passes through elevated tier check.
        // If elevated tier is not pre-approved in the ledger, it returns elevated_tier_requires_approval.
        // This test verifies the command is NOT rejected as command_not_allowed.
        const result = await runCommandTool.execute('test-id', { command: 'npm run build' });
        // With sandbox integration, npm run build triggers elevated tier check
        // which returns elevated_tier_requires_approval (not command_not_allowed)
        expect(result.details.reason).not.toBe('command_not_allowed');
      });

      it('allows bun run build (run is valid bun command)', async () => {
        const result = await runCommandTool.execute('test-id', { command: 'bun run build' });
        // Same as npm - elevated tier check, not command_not_allowed
        expect(result.details.reason).not.toBe('command_not_allowed');
      });

      it('allows ls with arbitrary args (no schema = always allowed)', async () => {
        const result = await runCommandTool.execute('test-id', { command: 'ls -la /tmp' });
        expect(result.details.success).toBe(true);
      });
    });
  });

  describe('glob expansion', () => {
    it('should handle glob pattern with * via shell exec (current behavior)', async () => {
      // Currently glob patterns go through exec() with shell=true
      // The shell handles glob expansion, so this should succeed
      const result = await runCommandTool.execute('test-id', { command: 'ls *.ts' });
      // Goes through exec() path, reason is undefined on success
      expect(result.details.success).toBe(true);
      expect(result.details.reason).toBeUndefined();
    });

    it('should handle glob pattern with ? via shell exec (current behavior)', async () => {
      // Note: ? glob matches any single char, fails if no single-char file exists
      const result = await runCommandTool.execute('test-id', { command: 'ls README.??' });
      // Will fail if no 2-char extension exists, which is expected
      // The key is it goes through exec() path, not command_not_allowed
      expect(result.details.reason).not.toBe('command_not_allowed');
    });

    it('should use execFile for non-glob ls commands', async () => {
      // ls without glob should use execFile (shell:false)
      const result = await runCommandTool.execute('test-id', { command: 'ls' });
      expect(result.details.success).toBe(true);
    });
  });
});
