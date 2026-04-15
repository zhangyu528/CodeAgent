import { describe, it, expect } from 'vitest';
import { parseFlags } from '../../../../../src/apps/cli/json/flags';

describe('parseFlags', () => {
  it('should return json: true when --json flag is present', () => {
    const result = parseFlags(['--json']);
    expect(result.json).toBe(true);
  });

  it('should return json: false when no flags are present', () => {
    const result = parseFlags([]);
    expect(result.json).toBe(false);
  });

  it('should extract --prompt value', () => {
    const result = parseFlags(['--json', '--prompt', 'hello world']);
    expect(result.json).toBe(true);
    expect(result.prompt).toBe('hello world');
  });

  it('should extract --session value', () => {
    const result = parseFlags(['--json', '--session', 'my-session']);
    expect(result.session).toBe('my-session');
  });

  it('should ignore unknown flags without error', () => {
    const result = parseFlags(['--unknown', '--json']);
    expect(result.json).toBe(true);
  });

  it('should return undefined for --prompt when no value follows', () => {
    const result = parseFlags(['--prompt']);
    expect(result.prompt).toBeUndefined();
  });

  it('should handle multiple flags in any order', () => {
    const result = parseFlags(['--session', 'test', '--json', '--prompt', 'hi']);
    expect(result.json).toBe(true);
    expect(result.session).toBe('test');
    expect(result.prompt).toBe('hi');
  });

  it('should treat next flag as value if previous consumed', () => {
    // This is expected behavior: --prompt --json means prompt="--json"
    const result = parseFlags(['--prompt', '--json']);
    expect(result.prompt).toBe('--json');
  });
});
