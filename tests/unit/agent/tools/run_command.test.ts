import { describe, it, expect } from 'vitest';
import { runCommandTool } from '../../../../src/agent/tools/run_command';

describe('runCommandTool', () => {
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

  it('should return an object with content and details when executed', async () => {
    const result = await runCommandTool.execute('test-id', { command: 'echo hello' });
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should execute a simple command successfully', async () => {
    const result = await runCommandTool.execute('test-id', { command: 'echo hello' });
    expect(result.details.command).toBe('echo hello');
    expect(result.details.success).toBe(true);
    expect(result.content[0].text).toContain('hello');
  });

  it('should return failure result for non-zero exit code', async () => {
    // Use a command that will fail
    const result = await runCommandTool.execute('test-id', { command: 'exit 1' });
    expect(result.details.command).toBe('exit 1');
    expect(result.details.success).toBe(false);
  });
});
