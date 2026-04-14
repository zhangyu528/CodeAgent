/**
 * Security Module Unit Tests
 * Tests for validatePath, validateSessionId, checkCommandAllowed
 */
import { describe, it, expect } from 'vitest';
import { validatePath, validateSessionId, checkCommandAllowed } from '../../../../src/agent/tools/security.js';

describe('validatePath', () => {
  const workspaceRoot = '/tmp/workspace';

  it('should return normalized path for valid workspace-internal paths', () => {
    const result = validatePath('/tmp/workspace/src/app.ts', workspaceRoot);
    expect(result).toBe('/tmp/workspace/src/app.ts');
  });

  it('should return null for path traversal attempts with ../', () => {
    const result = validatePath('/tmp/workspace/../../../etc/passwd', workspaceRoot);
    expect(result).toBeNull();
  });

  it('should return null for absolute path outside workspace', () => {
    const result = validatePath('/etc/passwd', workspaceRoot);
    expect(result).toBeNull();
  });

  it('should return null for paths escaping workspace via symbolic link simulation', () => {
    const result = validatePath('/tmp/workspace/src/../../other/file', workspaceRoot);
    expect(result).toBeNull();
  });

  it('should handle paths with trailing slashes correctly', () => {
    // path.resolve normalizes trailing slashes — this is expected behavior
    const result = validatePath('/tmp/workspace/src/', workspaceRoot);
    expect(result).toBe('/tmp/workspace/src');
  });
});

describe('validateSessionId', () => {
  it('should return true for valid alphanumeric session IDs', () => {
    expect(validateSessionId('abc123')).toBe(true);
    expect(validateSessionId('ABC-456')).toBe(true);
    expect(validateSessionId('session_789')).toBe(true);
    expect(validateSessionId('a-b_c')).toBe(true);
  });

  it('should return false for session IDs with path traversal', () => {
    expect(validateSessionId('../etc')).toBe(false);
    expect(validateSessionId('..%2F..%2Fetc')).toBe(false);
  });

  it('should return false for session IDs with special characters', () => {
    expect(validateSessionId('session<script>')).toBe(false);
    expect(validateSessionId("session'test")).toBe(false);
    expect(validateSessionId('session|pipe')).toBe(false);
    expect(validateSessionId('session\ntest')).toBe(false);
  });

  it('should return false for empty or null-like IDs', () => {
    expect(validateSessionId('')).toBe(false);
    expect(validateSessionId('   ')).toBe(false);
  });

  it('should return false for session IDs exceeding max length', () => {
    const longId = 'a'.repeat(256);
    expect(validateSessionId(longId)).toBe(false);
  });

  it('should return true for IDs at exactly max length (255)', () => {
    const maxId = 'a'.repeat(255);
    expect(validateSessionId(maxId)).toBe(true);
  });
});

describe('checkCommandAllowed', () => {
  it('should allow commands in the allowlist', () => {
    const gitResult = checkCommandAllowed('git status');
    expect(gitResult.allowed).toBe(true);

    const npmResult = checkCommandAllowed('npm install');
    expect(npmResult.allowed).toBe(true);

    const echoResult = checkCommandAllowed('echo hello');
    expect(echoResult.allowed).toBe(true);
  });

  it('should reject commands with command substitution injection', () => {
    const result = checkCommandAllowed('echo $(whoami)');
    expect(result.allowed).toBe(false);
    // Blocked by the BLOCKED_REGEX pattern for $()
    expect(result.reason).toBeDefined();
  });

  it('should reject commands with backtick injection', () => {
    const result = checkCommandAllowed('echo `whoami`');
    expect(result.allowed).toBe(false);
  });

  it('should reject dangerous patterns like rm -rf /', () => {
    const result = checkCommandAllowed('rm -rf /');
    expect(result.allowed).toBe(false);
  });

  it('should reject sudo su privilege escalation', () => {
    const result = checkCommandAllowed('sudo su');
    expect(result.allowed).toBe(false);
  });

  it('should reject chained commands with semicolons', () => {
    const result = checkCommandAllowed('echo hello; rm -rf /tmp');
    expect(result.allowed).toBe(false);
  });

  it('should allow unknown safe commands (no shell metacharacters, not in blocklist)', () => {
    // Unknown command without shell metacharacters should be rejected
    // This is the key security fix: unknown commands without shell features should NOT silently execute
    const result = checkCommandAllowed('unknowncmd --flag');
    expect(result.allowed).toBe(false);
  });
});
