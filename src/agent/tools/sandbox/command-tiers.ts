/**
 * Command Tier Classification
 * 
 * Classifies shell commands into three permission tiers:
 * - safe: auto-approved, runs via execFile (shell-isolated)
 * - elevated: approved once per session, runs via execFile  
 * - dangerous: always requires confirmation or is blocked
 */

import { BLOCKED_REGEX, isCommandBlocked } from '../security-patterns.js';

export type CommandTier = 'safe' | 'elevated' | 'dangerous';

/**
 * Commands that are classified as dangerous regardless of arguments.
 * These are intercepted by BLOCKED_REGEX before tier classification.
 */
export const DANGEROUS_COMMANDS = new Set([
  'rm',
  'dd',
  'mkfs',
  'fdisk',
  'sfdisk',
  'parted',
]);

/**
 * Commands that require elevated permissions (state-modifying operations).
 * These are allowed but require user confirmation once per session.
 */
export const ELEVATED_COMMANDS = new Set([
  'git push',
  'git push --force',
  'npm publish',
  'yarn publish',
  'pnpm publish',
  'npm install',
  'yarn install',
  'pnpm install',
  'docker rmi',
  'docker rm',
  'docker push',
  'kill',
  'pkill',
]);

/**
 * Classifies a command string into its permission tier.
 * 
 * Priority:
 * 1. BLOCKED_REGEX match → dangerous (already blocked before this runs)
 * 2. Exact match in ELEVATED_COMMANDS → elevated
 * 3. Base command in DANGEROUS_COMMANDS → dangerous
 * 4. Default → safe
 */
export function classifyCommand(command: string): CommandTier {
  const trimmed = command.trim().toLowerCase();

  // First: check blocked regex (security-critical, checked first)
  if (isCommandBlocked(trimmed)) {
    return 'dangerous';
  }

  // Second: check exact ELEVATED match (whole command string)
  if (ELEVATED_COMMANDS.has(trimmed)) {
    return 'elevated';
  }

  // Third: check base command against DANGEROUS set
  const baseCmd = trimmed.split(/\s+/)[0] || '';
  if (DANGEROUS_COMMANDS.has(baseCmd)) {
    return 'dangerous';
  }

  // Default: safe
  return 'safe';
}
