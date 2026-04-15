/**
 * Workspace Root Resolution and Path Validation
 * 
 * Provides workspace boundary enforcement for tool execution.
 * All file operations must validate paths against the workspace root.
 */

import { validatePath } from '../security-patterns.js';

/**
 * Get the workspace root for path validation.
 * Supports CODEAGENT_WORKSPACE_ROOT env var, falls back to process.cwd().
 */
export function getWorkspaceRoot(): string {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
}

/**
 * Validates that all paths in a command are within the workspace root.
 * Returns { valid: true } if all paths are inside workspace,
 * or { valid: false, reason: string } if any path escapes.
 */
export function validateCommandPaths(
  command: string,
  workspaceRoot?: string
): { valid: true } | { valid: false; reason: string } {
  const root = workspaceRoot || getWorkspaceRoot();

  // Extract tokens that look like absolute paths
  // Absolute paths start with / (Unix) and are not options (don't start with -)
  const tokens = command.split(/\s+/);

  for (const token of tokens) {
    // Skip empty tokens
    if (!token) continue;

    // Skip options (tokens starting with - that are arguments, not paths)
    // But /path/to/something is a path even if preceded by other options
    // Strategy: if token starts with / and has at least 2 chars, treat as path
    if (token.startsWith('/') && token.length > 1) {
      // This is an absolute path — validate it
      // Note: this won't catch things like `ls -la /workspace` where /workspace is valid
      // but it will catch `cat /etc/passwd` type escape attempts
      const resolved = validatePath(token, root);
      if (!resolved) {
        return {
          valid: false,
          reason: `Path outside workspace: ${token}`,
        };
      }
    }
  }

  return { valid: true };
}
