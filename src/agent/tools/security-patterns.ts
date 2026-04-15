/**
 * Security Pattern Definitions — Single Source of Truth
 *
 * Centralizes security-critical pattern definitions to prevent
 * duplication and ensure consistent enforcement across all tools.
 *
 * BLOCKED_REGEX: Dangerous command patterns that are ALWAYS blocked,
 * regardless of allowlist membership.
 *
 * ALLOWED_COMMANDS: Known-safe commands that may execute without shell isolation.
 */

import * as path from 'path';

// ─── Blocked Patterns ─────────────────────────────────────────────────────────

/**
 * Dangerous command patterns — checked FIRST before any allowlist evaluation.
 * Order of patterns matters: more specific (anchored) patterns should come
 * before general ones to prevent bypass via reordering.
 *
 * ReDoS verified: no nested quantifiers — all quantifiers apply only to [\s],
 * not to character classes that could match broadly.
 */
export const BLOCKED_REGEX = /\$\(|\`[^\`]*\`|\|\||&&|;\s*rm|^rm\s+-rf\s+\/\s*$|^dd\s+|^mkfs|^format\s+|^fdisk|^sfdisk|^parted|sudo\s+su|^su\s+-|[<>]\s*[\w\/]/i;

// ─── Command Allowlist ────────────────────────────────────────────────────────

/**
 * Known-safe commands that may execute via execFile (shell-isolated).
 * Commands in this list are permitted without shell metacharacter restrictions.
 */
export const ALLOWED_COMMANDS = new Set([
  // Read-only filesystem
  'ls', 'pwd', 'cat', 'head', 'tail', 'grep', 'wc', 'find', 'stat', 'diff',
  // File operations
  'touch', 'mkdir', 'cp', 'mv', 'rm',
  // Shell builtins
  'echo', 'printf', 'true', 'false', 'exit', 'export', 'cd', 'type',
  // Version control
  'git', 'hg',
  // Package managers
  'npm', 'bun', 'pnpm', 'yarn',
  // Runtime
  'node', 'python', 'python3', 'ruby', 'go', 'cargo', 'rustc',
  // Build tools
  'make', 'cmake', 'gcc', 'g++',
  // Utilities
  'curl', 'wget', 'tar', 'gzip', 'gunzip', 'zip', 'unzip', 'chmod', 'chown',
  // Editors & Interactive
  'vim', 'nano', 'less', 'more', 'man',
  // Remote
  'ssh', 'scp', 'rsync',
]);

// ─── Security Helpers ─────────────────────────────────────────────────────────

/**
 * Tests a command string against the blocked pattern list.
 * Returns true if the command contains any dangerous pattern.
 */
export function isCommandBlocked(command: string): boolean {
  return BLOCKED_REGEX.test(command.trim());
}

/**
 * Tests if a command base is in the allowlist.
 * Returns true if the command is permitted without shell isolation.
 */
export function isCommandAllowed(baseCmd: string): boolean {
  return ALLOWED_COMMANDS.has(baseCmd.toLowerCase());
}

// ─── Path Validation ──────────────────────────────────────────────────────────

/**
 * Validates that a path is within the workspace root.
 * Returns the normalized path if valid, null if it escapes the workspace.
 */
export function validatePath(inputPath: string, workspaceRoot: string): string | null {
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

// ─── Session ID Validation ────────────────────────────────────────────────────

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

// ─── Shell Metacharacter Detection ────────────────────────────────────────────

/**
 * Shell metacharacters that require shell=true to work.
 * If any of these appear, the command must go through exec() with shell=true.
 * Includes glob metacharacters (* ? [ ]) because shell expansion is needed for them.
 */
export const SHELL_METACHAR_REGEX = /[|&;()<>`*?[\]]/;

/**
 * Returns true if the command contains any shell metacharacter.
 */
export function hasShellMetacharacters(command: string): boolean {
  return SHELL_METACHAR_REGEX.test(command);
}
