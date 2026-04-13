import { z } from 'zod';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Compiled regex: BLOCKED patterns — dangerous command injections and destructive operations
// Checked FIRST to prevent allowlist short-circuiting
// Combined into single RegExp for performance
const BLOCKED_REGEX = /\$\(|[^`]`|\|\||&&|;\s*rm|^rm\s+-rf\s+\/\s*$|^dd\s+|^mkfs|^format\s+|^fdisk|^sfdisk|^parted|sudo\s+su|^su\s+-|[<>]\s*[\w\/]/i;

// Shell metacharacters that require shell=true to work
// If any of these appear, the command must go through exec() with shell=true
const SHELL_METACHAR_REGEX = /[|&;()<>`]/;

// Compiled regex: ALLOWED commands (returns first capturing group = command name)
// Expanded to include common developer commands
const ALLOWED_REGEX = /^(?:(echo|cat|head|tail|grep|wc|ls|pwd|true|false|printf|touch|mkdir|cd|export|exit|git|npm|bun|pnpm|yarn|node|python|python3|ruby|go|cargo|rustc|make|cmake|gcc|g\+\+|curl|wget|tar|gzip|gunzip|zip|unzip|chmod|chown|find|stat|diff|cp|mv|rm)\s+)/i;

// Commands that need glob pre-expansion (shell features in arguments)
const GLOB_COMMANDS = new Set(['ls', 'cp', 'rm']);

// Per-command timeout in ms (default 30s, longer for package managers)
const COMMAND_TIMEOUTS: Record<string, number> = {
  npm: 120000,
  bun: 120000,
  pnpm: 120000,
  yarn: 120000,
  git: 60000,
  make: 60000,
  cmake: 60000,
  // Default for all other commands
  default: 30000,
};

function getTimeout(command: string): number {
  const cmd = command.split(/\s+/)[0] ?? 'default';
  return COMMAND_TIMEOUTS[cmd] ?? 30000;
}

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
  // but not explicitly blocked — let them run (with shell=true)
  return false;
}

// Parse command string into [cmd, ...args] for execFile
function parseCommand(command: string): { cmd: string; args: string[] } {
  // Simple shell-like parsing: handle quoted strings
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of command) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) {
    tokens.push(current);
  }

  const cmd = tokens[0] || '';

  // Security: reject commands with path separators to prevent path injection
  // Only allow bare command names (e.g., 'node', 'npm') not './node' or '/usr/bin/node'
  if (cmd.includes('/') || cmd.includes('\\')) {
    return { cmd: '', args: [] };
  }

  return { cmd, args: tokens.slice(1) };
}

export const runCommandTool = {
  name: 'run_command',
  label: 'Running Command',
  description: 'Run a shell command.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute.'),
  }),
  execute: async (toolCallId: string, { command }: { command: string }): Promise<AgentToolResult<any>> => {
    const trimmed = command.trim();

    // If command contains shell metacharacters, it must use exec() with shell=true
    // These commands can't use execFile (shell:false) anyway
    if (SHELL_METACHAR_REGEX.test(trimmed)) {
      // Security check: block dangerous patterns FIRST
      if (isCommandBlocked(trimmed)) {
        return {
          content: [{ type: 'text', text: `Command blocked for security reasons: potentially dangerous pattern detected.` }],
          details: { command, success: false, reason: 'blocked_dangerous_pattern' },
        };
      }

      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
        const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
        return { content: [{ type: 'text', text: output }], details: { command, success: true } };
      } catch (error: unknown) {
        const err = error as {killed?: boolean; signal?: string; message?: string; stderr?: string; timedOut?: boolean};
        if (err.killed || err.signal === 'SIGTERM' || err.timedOut) {
          return {
            content: [{ type: 'text', text: `Command timed out after 30 seconds` }],
            details: { command, success: false, reason: 'timeout' }
          };
        }
        const output = `Command failed: ${err.message || String(error)}${err.stderr ? `\nStderr:\n${err.stderr}` : ''}`;
        return { content: [{ type: 'text', text: output }], details: { command, success: false } };
      }
    }

    // No shell metacharacters — use shell-isolated execFile for allowlisted commands
    const match = command.match(ALLOWED_REGEX);
    if (match) {
      const { cmd, args } = parseCommand(command);
      const timeout = getTimeout(command);
      try {
        const { stdout, stderr } = await execFileAsync(cmd, args, { timeout, maxBuffer: 5 * 1024 * 1024 });
        const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
        return { content: [{ type: 'text', text: output }], details: { command, success: true } };
      } catch (error: unknown) {
        const err = error as {killed?: boolean; signal?: string; message?: string; stderr?: string; timedOut?: boolean};
        if (err.killed || err.signal === 'SIGTERM' || err.timedOut) {
          return {
            content: [{ type: 'text', text: `Command timed out after ${timeout / 1000} seconds` }],
            details: { command, success: false, reason: 'timeout' }
          };
        }
        const output = `Command failed: ${err.message || String(error)}${err.stderr ? `\nStderr:\n${err.stderr}` : ''}`;
        return { content: [{ type: 'text', text: output }], details: { command, success: false } };
      }
    }

    // Non-allowlisted commands without shell metacharacters — use exec with shell=true
    // Security: blocklist still applies
    if (isCommandBlocked(trimmed)) {
      return {
        content: [{ type: 'text', text: `Command blocked for security reasons: potentially dangerous pattern detected.` }],
        details: { command, success: false, reason: 'blocked_dangerous_pattern' },
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
      const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
      return { content: [{ type: 'text', text: output }], details: { command, success: true } };
    } catch (error: unknown) {
      const err = error as {killed?: boolean; signal?: string; message?: string; stderr?: string; timedOut?: boolean};
      if (err.killed || err.signal === 'SIGTERM' || err.timedOut) {
        return {
          content: [{ type: 'text', text: `Command timed out after 30 seconds` }],
          details: { command, success: false, reason: 'timeout' }
        };
      }
      const output = `Command failed: ${err.message || String(error)}${err.stderr ? `\nStderr:\n${err.stderr}` : ''}`;
      return { content: [{ type: 'text', text: output }], details: { command, success: false } };
    }
  },
};
