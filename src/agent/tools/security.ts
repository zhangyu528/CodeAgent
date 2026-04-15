/**
 * Security Validation Module
 * Shared validation functions for path traversal prevention,
 * session ID validation, and command allowlisting.
 */

import * as path from 'path';

// ─── Path Validation ──────────────────────────────────────────────────────────

/**
 * Validates that a path is within the workspace root.
 * Returns the normalized path if valid, null if it escapes the workspace.
 */
export function validatePath(inputPath: string, workspaceRoot: string): string | null {
  // Expand ~ if present at the START of the path (Node.js path.resolve doesn't do this)
  let resolvedPath: string;
  if (inputPath.startsWith('~')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
    const expandedPath = inputPath.replace(/^~/, homeDir);
    resolvedPath = path.resolve(expandedPath);
  } else {
    resolvedPath = path.resolve(inputPath);
  }

  const normalizedWorkspace = path.resolve(workspaceRoot) + path.sep;

  if (!resolvedPath.startsWith(normalizedWorkspace)) {
    return null;
  }

  return resolvedPath;
}

// ─── Session ID Validation ─────────────────────────────────────────────────────

// Session ID must be alphanumeric, hyphen, or underscore — rejects path traversal
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_SESSION_ID_LENGTH = 255;

/**
 * Validates a session ID for security.
 * Rejects path traversal characters, special characters, and overly long IDs.
 */
export function validateSessionId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > MAX_SESSION_ID_LENGTH) return false;
  return SESSION_ID_REGEX.test(id);
}

// ─── Command Allowlist ─────────────────────────────────────────────────────────

// Blocked command patterns — checked FIRST before allowlist
const BLOCKED_REGEX = /\$\(|`|[|&;()<>]|rm\s+-rf|dd\s+|mkfs|format\s+|fdisk|sfdisk|parted|sudo\s+su|su\s+-|chmod\s+777|chown\s+/i;

// Known-safe commands (expanded developer set)
const ALLOWED_COMMANDS = new Set([
  'echo', 'cat', 'head', 'tail', 'grep', 'wc', 'ls', 'pwd', 'true', 'false',
  'printf', 'touch', 'mkdir', 'cd', 'export', 'exit', 'git', 'npm', 'bun',
  'pnpm', 'yarn', 'node', 'python', 'python3', 'ruby', 'go', 'cargo', 'rustc',
  'make', 'cmake', 'gcc', 'g++', 'curl', 'wget', 'tar', 'gzip', 'gunzip',
  'zip', 'unzip', 'chmod', 'chown', 'find', 'stat', 'diff', 'cp', 'mv', 'rm',
]);

/**
 * Checks if a command is allowed to execute.
 * Returns { allowed: true } for safe commands.
 * Returns { allowed: false, reason: string } for blocked or unknown commands.
 *
 * Unknown commands (not in allowlist, no shell metacharacters) are now REJECTED
 * to close the silent fallback security gap.
 */
export function checkCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();

  // Check blocked patterns first
  if (BLOCKED_REGEX.test(trimmed)) {
    return { allowed: false, reason: 'blocked_dangerous_pattern' };
  }

  // Extract the base command
  const baseCmd = trimmed.split(/\s+/)[0]?.toLowerCase() || '';

  // Check if it's in the allowlist
  if (ALLOWED_COMMANDS.has(baseCmd)) {
    return { allowed: true };
  }

  // Unknown commands are REJECTED — no silent fallback to exec()
  // This closes the security gap where unknown commands could execute
  return { allowed: false, reason: 'command_not_in_allowlist' };
}
