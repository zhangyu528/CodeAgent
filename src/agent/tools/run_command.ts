import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const execAsync = promisify(exec);

// Blocked patterns — dangerous command injections and destructive operations
// Note: Node.js exec() already shells out via /bin/sh, so we block shell-specific
// injection patterns rather than trying to whitelist commands.
const BLOCKED_PATTERNS = [
  // Command substitution — the primary injection vector
  /\$\(/,                    // $(command)
  /`[^`]+`/,                 // `command`
  /\|\s*\(/,                 // pipe to subshell: | (...)
  // Destructive commands that should never run unattended
  /^rm\s+-rf\s+\/\s*$/i,    // rm -rf / (with optional trailing whitespace)
  /^dd\s+/i,                 // dd (disk destructive)
  /^mkfs/i,                  // mkfs (filesystem creation)
  /^format\s+/i,             // format (disk format)
  /^fdisk/i,                 // fdisk (partition editing)
  /^sfdisk/i,                // sfdisk
  /^parted/i,                // parted
  // Privilege escalation
  /sudo\s+su/i,             // sudo su
  /^su\s+-/i,                // su with flags
];

// Patterns that are ALLOWED (common legitimate uses)
// These would otherwise match blocked patterns but are safe
const ALLOWED_PATTERNS = [
  /^echo\s+/i,              // echo is safe
  /^cat\s+/i,               // cat is safe
  /^head\s+/i,              // head is safe
  /^tail\s+/i,              // tail is safe
  /^grep\s+/i,              // grep is safe
  /^wc\s+/i,                // wc is safe
  /^ls\s+/i,                // ls is safe
  /^pwd$/i,                 // pwd is safe
  /^true$/i,                // true is safe
  /^false$/i,               // false is safe
  /^printf\s+/i,            // printf is safe
  /^touch\s+/i,             // touch is safe
  /^mkdir\s+/i,             // mkdir is safe
  /^cd\s+/i,                // cd is safe
  /^export\s+/i,            // export is safe
  /^exit\s+/i,              // exit is safe
];

// Warn once when security bypass is active
let unsafeBypassWarned = false;

function isCommandBlocked(command: string): boolean {
  // Allow override via environment variable (for trusted environments)
  if (process.env.RUN_COMMAND_UNSAFE === '1') {
    if (!unsafeBypassWarned) {
      console.warn('[run_command] WARNING: RUN_COMMAND_UNSAFE=1 is set — all security checks are bypassed. This is not recommended for untrusted environments.');
      unsafeBypassWarned = true;
    }
    return false;
  }

  const trimmed = command.trim();

  // Check if it's a known-safe command first (allows common tools)
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

export const runCommandTool = {
  name: 'run_command',
  label: 'Running Command',
  description: 'Run a shell command.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute.'),
  }),
  execute: async (toolCallId: string, { command }: { command: string }): Promise<AgentToolResult<any>> => {
    // Security check: block dangerous patterns
    if (isCommandBlocked(command)) {
      return {
        content: [{ type: 'text', text: `Command blocked for security reasons: potentially dangerous pattern detected. Set RUN_COMMAND_UNSAFE=1 to bypass (not recommended).` }],
        details: { command, success: false, reason: 'blocked_dangerous_pattern' },
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command);
      const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
      return { content: [{ type: 'text', text: output }], details: { command, success: true } };
    } catch (error: any) {
      const output = `Command failed: ${error.message}${error.stderr ? `\nStderr:\n${error.stderr}` : ''}`;
      return { content: [{ type: 'text', text: output }], details: { command, success: false } };
    }
  },
};
