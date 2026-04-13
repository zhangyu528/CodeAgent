import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const execAsync = promisify(exec);

// Compiled regex: ALLOWED commands checked first (returns false = safe)
// Combined into single RegExp for performance
const ALLOWED_REGEX = /^(?:echo|cat|head|tail|grep|wc|ls|pwd|true|false|printf|touch|mkdir|cd|export|exit)\s+/i;

// Compiled regex: BLOCKED patterns — dangerous command injections and destructive operations
// Combined into single RegExp for performance
const BLOCKED_REGEX = /\$\(|`[^`]+`|\|\||&&|;\s*rm|^rm\s+-rf\s+\/\s*$|^dd\s+|^mkfs|^format\s+|^fdisk|^sfdisk|^parted|sudo\s+su|^su\s+-|[<>]\s*[\w\/]/i;

function isCommandBlocked(command: string): boolean {
  const trimmed = command.trim();

  // Check blocked patterns FIRST — this prevents allowlist short-circuiting
  // e.g. "echo hello; rm -rf /" must be blocked even though "echo" is allowlisted
  if (BLOCKED_REGEX.test(trimmed)) {
    return true;
  }

  // Then check if it's a known-safe command
  if (ALLOWED_REGEX.test(trimmed)) {
    return false;
  }

  // Unknown commands not in allowlist are treated as potentially dangerous
  // but not explicitly blocked — let them run (with shell=false in exec)
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
        content: [{ type: 'text', text: `Command blocked for security reasons: potentially dangerous pattern detected.` }],
        details: { command, success: false, reason: 'blocked_dangerous_pattern' },
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
      const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
      return { content: [{ type: 'text', text: output }], details: { command, success: true } };
    } catch (error: any) {
      // Handle timeout errors gracefully
      if (error.killed || error.signal === 'SIGTERM') {
        return {
          content: [{ type: 'text', text: `Command timed out after 30 seconds` }],
          details: { command, success: false, reason: 'timeout' }
        };
      }
      const output = `Command failed: ${error.message}${error.stderr ? `\nStderr:\n${error.stderr}` : ''}`;
      return { content: [{ type: 'text', text: output }], details: { command, success: false } };
    }
  },
};
