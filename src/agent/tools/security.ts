/**
 * Security Validation Module
 * Shared validation functions for path traversal prevention,
 * session ID validation, and command allowlisting.
 *
 * @deprecated All security patterns are now centralized in security-patterns.ts.
 * This module re-exports those patterns for backward compatibility.
 * New code should import directly from security-patterns.ts.
 */

import * as path from 'path';
import {
  BLOCKED_REGEX,
  ALLOWED_COMMANDS,
  isCommandBlocked,
  isCommandAllowed,
  SHELL_METACHAR_REGEX,
  hasShellMetacharacters,
  COMMAND_ALLOWLIST,
  getCommandSchema,
  validateCommandArgs,
} from './security-patterns.js';

// Re-export for backward compatibility
export {
  BLOCKED_REGEX,
  ALLOWED_COMMANDS,
  isCommandBlocked,
  isCommandAllowed,
  SHELL_METACHAR_REGEX,
  hasShellMetacharacters,
  COMMAND_ALLOWLIST,
  getCommandSchema,
  validateCommandArgs,
};

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

// ─── Command Allowlist (legacy API) ──────────────────────────────────────────

/**
 * Checks if a command is allowed to execute.
 * Returns { allowed: true } for safe commands.
 * Returns { allowed: false, reason: string } for blocked or unknown commands.
 *
 * @deprecated Use isCommandBlocked() and isCommandAllowed() from security-patterns.ts directly.
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
