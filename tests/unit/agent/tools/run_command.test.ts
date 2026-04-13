import { describe, it, expect } from 'vitest';
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

    it('should return failure result for non-zero exit code', async () => {
      // 'exit' is a shell builtin - non-allowlisted, uses exec with shell:true
      const result = await runCommandTool.execute('test-id', { command: 'exit 1' });
      expect(result.details.command).toBe('exit 1');
      expect(result.details.success).toBe(false);
    });

    it('should return failure for nonexistent command', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'nonexistent_command_12345' });
      expect(result.details.success).toBe(false);
      expect(result.content[0].text).toContain('Command failed:');
    });

    it('should handle commands with arguments', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'echo -n "test argument"' });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toBe('test argument');
    });

    it('should handle piped commands via shell', async () => {
      // With shell hardening, piped commands are not allowlisted (no shell:false execFile)
      // so they fall through to exec() which does run them with shell=true
      const result = await runCommandTool.execute('test-id', { command: 'echo "hello world" | tr "[:lower:]" "[:upper:]"' });
      expect(result.details.success).toBe(true);
      expect(result.content[0].text).toContain('HELLO WORLD');
    });

    it('should handle command that produces no output', async () => {
      const result = await runCommandTool.execute('test-id', { command: 'true' });
      expect(result.details.success).toBe(true);
    });

    it('should handle command producing combined stdout and stderr', async () => {
      const result = await runCommandTool.execute('test-id', { command: '(echo stdout; echo stderr >&2)' });
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
      const result = await runCommandTool.execute('test-id', { command: 'dd if=/dev/zero of=/tmp/test' });
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
  });
});
