/**
 * Tool Security Integration Tests
 * Tests security boundaries for write_file and run_command tools
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileTool } from '../../src/agent/tools/write_file.js';
import { runCommandTool } from '../../src/agent/tools/run_command.js';

describe('write_file security', () => {
  // Set a known workspace root for tests
  const originalEnv = process.env.CODEAGENT_WORKSPACE_ROOT;

  beforeEach(() => {
    process.env.CODEAGENT_WORKSPACE_ROOT = '/tmp/codeagent-test-workspace';
  });

  it('should block path traversal attempts', async () => {
    const result = await writeFileTool.execute('test-call-id', {
      filePath: '../../../etc/passwd',
      content: 'malicious content',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    expect(typeof text === 'object' ? text.text : text).toContain('Path outside workspace');
  });

  it('should block absolute paths outside workspace', async () => {
    const result = await writeFileTool.execute('test-call-id', {
      filePath: '/etc/shadow',
      content: 'malicious content',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    expect(typeof text === 'object' ? text.text : text).toContain('Path outside workspace');
  });

  it('should block traversal to /tmp via ../..', async () => {
    const result = await writeFileTool.execute('test-call-id', {
      filePath: '/tmp/../../var/spool/malicious',
      content: 'malicious content',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    expect(typeof text === 'object' ? text.text : text).toContain('Path outside workspace');
  });

  it('should accept files within workspace root', async () => {
    const result = await writeFileTool.execute('test-call-id', {
      filePath: '/tmp/codeagent-test-workspace/test.txt',
      content: 'hello world',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    expect(typeof text === 'object' ? text.text : text).toContain('File written successfully');
  });
});

describe('run_command security', () => {
  it('should block or safely reject rm -rf /', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'rm -rf /',
    });

    // Either blocked by our guard OR safely rejected by rm's --no-preserve-root
    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    // The command must NOT execute successfully — it should be blocked or fail safely
    expect(
      textContent.toLowerCase().includes('blocked') ||
      textContent.toLowerCase().includes('dangerous') ||
      textContent.toLowerCase().includes('failed')
    ).toBe(true);
  });

  it('should block command substitution injection $(whoami)', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'echo $(whoami)',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    expect(textContent).toContain('blocked');
  });

  it('should block backtick command injection', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'echo `whoami`',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    expect(textContent).toContain('blocked');
  });

  it('should block chained commands with semicolon', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'echo hello; rm -rf /tmp',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    expect(textContent).toContain('blocked');
  });

  it('should allow git status command', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'git status',
    });

    // git status should either succeed or fail gracefully (not blocked)
    // It should not be blocked for security reasons
    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    expect(textContent).not.toContain('blocked_dangerous_pattern');
  });

  it('should allow safe echo command', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'echo "hello world"',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    expect(textContent.toLowerCase()).toContain('hello');
  });

  it('should block sudo su command', async () => {
    const result = await runCommandTool.execute('test-call-id', {
      command: 'sudo su',
    });

    const text = result.content[0]!;
    expect(text).toBeDefined();
    const textContent = typeof text === 'object' ? text.text : text;
    expect(textContent).toContain('blocked');
  });
});
