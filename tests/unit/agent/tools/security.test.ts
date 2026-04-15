/**
 * Security Module Unit Tests
 * Tests for validatePath, validateSessionId, checkCommandAllowed
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { validatePath, validateSessionId, checkCommandAllowed } from '../../../../src/agent/tools/security.js';

describe('validatePath', () => {
  // Use the project root which actually exists for testing
  const projectRoot = path.resolve('/mnt/d/work/project/CodeAgent');
  const srcDir = path.join(projectRoot, 'src');

  it('should return normalized path for valid workspace-internal paths', () => {
    const result = validatePath(path.join(projectRoot, 'package.json'), projectRoot);
    expect(result).toBe(path.join(projectRoot, 'package.json'));
  });

  it('should return null for path traversal attempts with ../', () => {
    const result = validatePath(path.join(projectRoot, '..', '..', 'etc', 'passwd'), projectRoot);
    expect(result).toBeNull();
  });

  it('should return null for absolute path outside workspace', () => {
    const result = validatePath('/etc/passwd', projectRoot);
    expect(result).toBeNull();
  });

  it('should return null for paths escaping workspace via ../', () => {
    const result = validatePath(path.join(projectRoot, 'src', '..', '..', 'other', 'file'), projectRoot);
    expect(result).toBeNull();
  });

  it('should handle paths with trailing slashes correctly', () => {
    // path.resolve normalizes trailing slashes — this is expected behavior
    const result = validatePath(path.join(projectRoot, 'src') + '/', projectRoot);
    expect(result).toBe(srcDir);
  });

  it('should expand tilde to home directory', () => {
    // This test verifies tilde expansion works
    const homeDir = process.env.HOME || '/home/user';
    const result = validatePath('~/project/file.txt', projectRoot);
    // Tilde expansion should work, but the result is validated against workspace
    const expectedResolved = path.join(homeDir, 'project/file.txt');
    if (expectedResolved.startsWith(projectRoot + path.sep)) {
      expect(result).toBe(expectedResolved);
    } else {
      expect(result).toBeNull();
    }
  });

  it('should return null for tilde path that escapes workspace after expansion', () => {
    const result = validatePath('~/../../etc/passwd', projectRoot);
    expect(result).toBeNull();
  });

  it('should handle tilde paths when HOME is inside workspace', () => {
    // Test that tilde expansion works correctly when HOME is inside workspace
    const originalHome = process.env.HOME;
    process.env.HOME = projectRoot;
    try {
      const result = validatePath('~/file.txt', projectRoot);
      expect(result).toBe(path.join(projectRoot, 'file.txt'));
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it('should return normalized path for subdirectory inside workspace', () => {
    const result = validatePath(path.join(projectRoot, 'src', 'app.ts'), projectRoot);
    expect(result).toBe(path.join(projectRoot, 'src', 'app.ts'));
  });

  it('should handle paths with redundant slashes', () => {
    const result = validatePath(path.join(projectRoot, 'src') + '//app.ts', projectRoot);
    expect(result).toBe(path.join(projectRoot, 'src', 'app.ts'));
  });

  it('should handle paths with . and .. mixed', () => {
    const result = validatePath(path.join(projectRoot, '.', 'src', '..', 'src', 'app.ts'), projectRoot);
    expect(result).toBe(path.join(projectRoot, 'src', 'app.ts'));
  });

  it('should return null for deeply nested path traversal', () => {
    const result = validatePath(
      path.join(projectRoot, 'a', 'b', 'c', 'd', 'e', 'f', '..', '..', '..', '..', '..', '..', '..', '..', 'etc', 'passwd'),
      projectRoot
    );
    expect(result).toBeNull();
  });

  it('should return null for path that resolves to workspace parent', () => {
    const result = validatePath(path.join(projectRoot, '..'), projectRoot);
    expect(result).toBeNull();
  });

  it('should return null for path outside workspace with spaces', () => {
    const result = validatePath('/mnt/d/work project/file.txt', projectRoot);
    expect(result).toBeNull();
  });

  it('should return null for path that is exactly the parent of workspace', () => {
    const parentDir = path.dirname(projectRoot);
    const result = validatePath(parentDir, projectRoot);
    expect(result).toBeNull();
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

  it('should reject unknown commands that are not in allowlist', () => {
    const result = checkCommandAllowed('unknowncmd --flag');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('command_not_in_allowlist');
  });
});
