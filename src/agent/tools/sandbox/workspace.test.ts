import { describe, it, expect } from 'vitest';
import { getWorkspaceRoot, validateCommandPaths } from './workspace.js';

describe('getWorkspaceRoot', () => {
  it('returns CODEAGENT_WORKSPACE_ROOT when set', () => {
    const original = process.env.CODEAGENT_WORKSPACE_ROOT;
    process.env.CODEAGENT_WORKSPACE_ROOT = '/custom/workspace';
    // Need to re-import to pick up env change — but since module caches, we test via the function
    // The function reads process.env dynamically, so this should work
    expect(getWorkspaceRoot()).toBe('/custom/workspace');
    if (original !== undefined) {
      process.env.CODEAGENT_WORKSPACE_ROOT = original;
    } else {
      delete process.env.CODEAGENT_WORKSPACE_ROOT;
    }
  });

  it('returns process.cwd() when CODEAGENT_WORKSPACE_ROOT is not set', () => {
    const original = process.env.CODEAGENT_WORKSPACE_ROOT;
    delete process.env.CODEAGENT_WORKSPACE_ROOT;
    expect(getWorkspaceRoot()).toBe(process.cwd());
    if (original !== undefined) {
      process.env.CODEAGENT_WORKSPACE_ROOT = original;
    }
  });
});

describe('validateCommandPaths', () => {
  it('returns valid for commands without absolute paths', () => {
    const result = validateCommandPaths('ls -la', '/tmp/workspace');
    expect(result.valid).toBe(true);
  });

  it('returns valid for absolute paths inside workspace', () => {
    const result = validateCommandPaths('cat /tmp/workspace/file.txt', '/tmp/workspace');
    expect(result.valid).toBe(true);
  });

  it('returns invalid for absolute paths outside workspace', () => {
    const result = validateCommandPaths('cat /etc/passwd', '/tmp/workspace');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('outside workspace');
  });

  it('returns invalid for path traversal attempts', () => {
    const result = validateCommandPaths('cat /tmp/../../etc/passwd', '/tmp/workspace');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('outside workspace');
  });

  it('returns valid for relative paths', () => {
    const result = validateCommandPaths('grep -r "pattern" src/', '/home/user/project');
    expect(result.valid).toBe(true);
  });

  it('handles commands with no tokens', () => {
    const result = validateCommandPaths('', '/tmp/workspace');
    expect(result.valid).toBe(true);
  });
});
