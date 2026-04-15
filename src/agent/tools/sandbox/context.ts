/**
 * Tool Execution Context — Unified Sandboxing API
 *
 * Provides a consistent execution environment for all tool operations:
 * - Path validation (workspace root boundaries)
 * - Command execution (shell-isolated, timeout, resource limits)
 * - Permission classification (safe / elevated / dangerous tiers)
 */

import { execFile, exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import {
  BLOCKED_REGEX,
  isCommandBlocked,
  isCommandAllowed,
  validatePath as validatePathCore,
  getCommandSchema,
  validateCommandArgs,
  SHELL_METACHAR_REGEX,
  hasShellMetacharacters,
} from '../security-patterns.js';
import { classifyCommand, CommandTier } from './command-tiers.js';
import { PermissionLedger } from './permission-ledger.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// ─── Workspace Root ─────────────────────────────────────────────────────────

/**
 * Get the workspace root for path validation.
 * Supports CODEAGENT_WORKSPACE_ROOT env var, falls back to process.cwd().
 */
export function getWorkspaceRoot(): string {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ExecOptions {
  timeout?: number;
  maxBuffer?: number;
  shell?: boolean;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  killed?: boolean;
  timedOut?: boolean;
}

export interface CommandCheckResult {
  allowed: boolean;
  reason?: string;
  tier?: CommandTier;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_BUFFER = 5 * 1024 * 1024;

// ─── ToolExecutionContext ────────────────────────────────────────────────────

/**
 * Unified sandboxing context for tool execution.
 *
 * All file operations and command executions within a session should
 * go through this context to ensure consistent security enforcement.
 */
export class ToolExecutionContext {
  private workspaceRoot: string;
  private permissionLedger: PermissionLedger;
  private readonly timeouts: Record<string, number> = {
    npm: 120000,
    bun: 120000,
    pnpm: 120000,
    yarn: 120000,
    git: 60000,
    make: 60000,
    cmake: 60000,
  };

  constructor(options?: { workspaceRoot?: string; permissionLedger?: PermissionLedger }) {
    this.workspaceRoot = options?.workspaceRoot ?? getWorkspaceRoot();
    this.permissionLedger = options?.permissionLedger ?? new PermissionLedger();
  }

  // ─── Path Validation ────────────────────────────────────────────────────

  /**
   * Validates that a path is within the workspace root.
   * Returns the normalized path if valid, null if it escapes.
   */
  validatePath(inputPath: string): string | null {
    return validatePathCore(inputPath, this.workspaceRoot);
  }

  // ─── Command Classification ───────────────────────────────────────────────

  /**
   * Classify a command into its permission tier.
   */
  classifyCommand(command: string): CommandTier {
    return classifyCommand(command);
  }

  // ─── Command Permission ──────────────────────────────────────────────────

  /**
   * Check if a command is approved for execution.
   * Safe tier: always approved.
   * Elevated tier: approved if in ledger.
   * Dangerous tier: never approved (blocked at classification).
   */
  isApproved(command: string): boolean {
    const tier = classifyCommand(command);
    return this.permissionLedger.has(command, tier);
  }

  /**
   * Approve a command for elevated tier execution.
   */
  approveCommand(command: string): void {
    const tier = classifyCommand(command);
    this.permissionLedger.approve(command, tier);
  }

  // ─── Command Execution ────────────────────────────────────────────────────

  /**
   * Execute a command with sandboxed environment.
   *
   * - Commands without shell metacharacters: use execFile (shell-isolated)
   * - Commands with shell metacharacters: use exec with permission check
   * - BLOCKED_REGEX patterns: always rejected
   * - Elevated tier commands: require prior approval via approveCommand()
   */
  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    const trimmed = command.trim();
    const hasShellMetachars = SHELL_METACHAR_REGEX.test(trimmed);

    // SECURITY: Check blocked patterns first
    if (isCommandBlocked(trimmed)) {
      return {
        stdout: '',
        stderr: `Command blocked for security reasons: potentially dangerous pattern detected.`,
        exitCode: 1,
      };
    }

    if (hasShellMetachars) {
      // Shell command — require approval for elevated tier
      if (!this.isApproved(trimmed)) {
        const tier = classifyCommand(trimmed);
        if (tier === 'elevated') {
          return {
            stdout: '',
            stderr: `Command requires elevated permissions: '${trimmed}' is classified as elevated tier. Approve via permission ledger to proceed.`,
            exitCode: 1,
          };
        }
        // dangerous tier already blocked above
        return {
          stdout: '',
          stderr: `Command blocked: '${trimmed}'`,
          exitCode: 1,
        };
      }

      return this.execWithShell(trimmed, options);
    }

    // No shell metacharacters — check allowlist
    const baseCmd = trimmed.split(/\s+/)[0]?.toLowerCase() || '';
    if (!isCommandAllowed(baseCmd)) {
      return {
        stdout: '',
        stderr: `Command not allowed: '${baseCmd}' is not in the approved command list.`,
        exitCode: 1,
      };
    }

    // Elevated tier check for execFile
    if (!this.isApproved(trimmed)) {
      const tier = classifyCommand(trimmed);
      if (tier === 'elevated') {
        return {
          stdout: '',
          stderr: `Command requires elevated permissions: '${trimmed}' is classified as elevated tier. Approve via permission ledger to proceed.`,
          exitCode: 1,
        };
      }
    }

    // Argument validation via Zod schema
    const parsed = this.parseCommand(trimmed);
    const validation = validateCommandArgs(parsed.cmd, parsed.args);
    if (!validation.valid) {
      return {
        stdout: '',
        stderr: `Invalid arguments for '${parsed.cmd}': ${(validation as { valid: false; error: string }).error}`,
        exitCode: 1,
      };
    }

    return this.execFileIsolated(parsed.cmd, parsed.args, options);
  }

  // ─── File Operations ─────────────────────────────────────────────────────

  /**
   * Read a file within the workspace.
   * Returns content or throws on error.
   */
  async readFile(filePath: string): Promise<string> {
    const resolved = this.validatePath(filePath);
    if (!resolved) {
      throw new Error(`Path outside workspace: ${filePath}`);
    }
    return fs.readFile(resolved, 'utf-8');
  }

  /**
   * Write content to a file within the workspace.
   * Creates parent directories if needed.
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const resolved = this.validatePath(filePath);
    if (!resolved) {
      throw new Error(`Path outside workspace: ${filePath}`);
    }
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private async execWithShell(command: string, options?: ExecOptions): Promise<ExecResult> {
    const timeout = options?.timeout ?? this.getTimeout(command);
    const maxBuffer = options?.maxBuffer ?? DEFAULT_MAX_BUFFER;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const err = error as {
        killed?: boolean;
        signal?: string;
        message?: string;
        stderr?: string;
        timedOut?: boolean;
      };
      if (err.killed || err.signal === 'SIGTERM' || err.timedOut) {
        return {
          stdout: '',
          stderr: `Command timed out after ${timeout / 1000} seconds`,
          exitCode: 1,
          killed: err.killed,
          timedOut: true,
        };
      }
      return {
        stdout: '',
        stderr: `Command failed: ${err.message || String(error)}${err.stderr ? `\nStderr:\n${err.stderr}` : ''}`,
        exitCode: 1,
      };
    }
  }

  private async execFileIsolated(
    cmd: string,
    args: string[],
    options?: ExecOptions
  ): Promise<ExecResult> {
    const timeout = options?.timeout ?? this.getTimeout(cmd);
    const maxBuffer = options?.maxBuffer ?? DEFAULT_MAX_BUFFER;

    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout,
        maxBuffer,
        shell: false,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const err = error as {
        killed?: boolean;
        signal?: string;
        message?: string;
        stderr?: string;
        timedOut?: boolean;
      };
      if (err.killed || err.signal === 'SIGTERM' || err.timedOut) {
        return {
          stdout: '',
          stderr: `Command timed out after ${timeout / 1000} seconds`,
          exitCode: 1,
          killed: err.killed,
          timedOut: true,
        };
      }
      return {
        stdout: '',
        stderr: `Command failed: ${err.message || String(error)}${err.stderr ? `\nStderr:\n${err.stderr}` : ''}`,
        exitCode: 1,
      };
    }
  }

  private getTimeout(command: string): number {
    const cmd = command.split(/\s+/)[0] ?? 'default';
    return this.timeouts[cmd] ?? DEFAULT_TIMEOUT;
  }

  private parseCommand(command: string): { cmd: string; args: string[] } {
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
    return { cmd, args: tokens.slice(1) };
  }
}
