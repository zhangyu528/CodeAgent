/**
 * Security Pattern Definitions — Single Source of Truth
 *
 * Centralizes security-critical pattern definitions to prevent
 * duplication and ensure consistent enforcement across all tools.
 *
 * BLOCKED_REGEX: Dangerous command patterns that are ALWAYS blocked,
 * regardless of allowlist membership.
 *
 * COMMAND_ALLOWLIST: Known-safe commands with optional Zod schemas for argument validation.
 * Commands with schema !== null are validated via safeParse() before execution.
 * Commands with schema === null accept any arguments (backward compatible).
 */

import * as path from 'path';
import { z } from 'zod';

// ─── Blocked Patterns ─────────────────────────────────────────────────────────

/**
 * Dangerous command patterns — checked FIRST before any allowlist evaluation.
 * Order of patterns matters: more specific (anchored) patterns should come
 * before general ones to prevent bypass via reordering.
 *
 * ReDoS verified: no nested quantifiers — all quantifiers apply only to [\s],
 * not to character classes that could match broadly.
 */
export const BLOCKED_REGEX =
  /\$\(|\`[^\`]*\`|\|\||&&|;\s*rm|^rm\s+-rf\s+\/\s*$|^dd\s+|^mkfs|^format\s+|^fdisk|^sfdisk|^parted|sudo\s+su|^su\s+-|[<>]\s*[\w\/]/i;

// ─── Command Allowlist ────────────────────────────────────────────────────────

/**
 * Known-safe commands that may execute via execFile (shell-isolated).
 * Commands in this list are permitted without shell metacharacter restrictions.
 *
 * @deprecated Use COMMAND_ALLOWLIST instead. This Set is kept for backward
 * compatibility with security.ts checkCommandAllowed().
 */
export const ALLOWED_COMMANDS = new Set([
  // Read-only filesystem
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'grep',
  'wc',
  'find',
  'stat',
  'diff',
  // File operations
  'touch',
  'mkdir',
  'cp',
  'mv',
  'rm',
  // Shell builtins
  'echo',
  'printf',
  'true',
  'false',
  'exit',
  'export',
  'cd',
  'type',
  // Version control
  'git',
  'hg',
  // Package managers
  'npm',
  'bun',
  'pnpm',
  'yarn',
  // Runtime
  'node',
  'python',
  'python3',
  'ruby',
  'go',
  'cargo',
  'rustc',
  // Build tools
  'make',
  'cmake',
  'gcc',
  'g++',
  // Utilities
  'curl',
  'wget',
  'tar',
  'gzip',
  'gunzip',
  'zip',
  'unzip',
  'chmod',
  'chown',
  // Editors & Interactive
  'vim',
  'nano',
  'less',
  'more',
  'man',
  // Remote
  'ssh',
  'scp',
  'rsync',
]);

// ─── Command Allowlist with Zod Schemas ───────────────────────────────────────

/**
 * Zod schemas for commands that need argument validation.
 * Each schema validates the parsed arguments for its command.
 */
const GitArgsSchema = z.object({
  cmd: z.enum([
    'status',
    'log',
    'diff',
    'add',
    'commit',
    'push',
    'pull',
    'branch',
    'checkout',
    'fetch',
    'clone',
    'init',
    'remote',
    'stash',
    'reset',
    'rebase',
  ]),
});

const NpmArgsSchema = z.object({
  command: z.enum([
    'install',
    'run',
    'test',
    'build',
    'start',
    'dev',
    'pack',
    'publish',
    'audit',
    'ci',
    'login',
    'logout',
    'outdated',
    'update',
  ]),
  args: z.string().optional(),
});

const BunArgsSchema = z.object({
  command: z.enum(['install', 'run', 'test', 'build', 'add', 'remove', 'update', 'pm']),
  script: z.string().optional(),
});

const PnpmArgsSchema = z.object({
  command: z.enum(['install', 'run', 'test', 'build', 'dev', 'add', 'remove', 'update']),
  args: z.string().optional(),
});

const YarnArgsSchema = z.object({
  command: z.enum(['install', 'run', 'test', 'build', 'dev', 'add', 'remove', 'upgrade']),
  args: z.string().optional(),
});

/**
 * Command allowlist with optional Zod schemas for argument validation.
 *
 * - Commands with schema !== null: args are validated via safeParse() before execution
 * - Commands with schema === null: any arguments accepted (backward compatible)
 *
 * The keys must match the entries in ALLOWED_COMMANDS (for backward compatibility).
 */
export const COMMAND_ALLOWLIST: Record<string, z.ZodType | null> = {
  // Version control — with schema validation
  git: GitArgsSchema,
  hg: null,

  // Package managers — with schema validation
  npm: NpmArgsSchema,
  bun: BunArgsSchema,
  pnpm: PnpmArgsSchema,
  yarn: YarnArgsSchema,

  // Read-only filesystem — no schema (accept any args)
  ls: null,
  pwd: null,
  cat: null,
  head: null,
  tail: null,
  grep: null,
  wc: null,
  find: null,
  stat: null,
  diff: null,

  // File operations — no schema
  touch: null,
  mkdir: null,
  cp: null,
  mv: null,
  rm: null,

  // Shell builtins — no schema
  echo: null,
  printf: null,
  true: null,
  false: null,
  exit: null,
  export: null,
  cd: null,
  type: null,

  // Runtime — no schema
  node: null,
  python: null,
  python3: null,
  ruby: null,
  go: null,
  cargo: null,
  rustc: null,

  // Build tools — no schema
  make: null,
  cmake: null,
  gcc: null,
  'g++': null,

  // Utilities — no schema
  curl: null,
  wget: null,
  tar: null,
  gzip: null,
  gunzip: null,
  zip: null,
  unzip: null,
  chmod: null,
  chown: null,

  // Editors & Interactive — no schema
  vim: null,
  nano: null,
  less: null,
  more: null,
  man: null,

  // Remote — no schema
  ssh: null,
  scp: null,
  rsync: null,
};

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

/**
 * Returns the Zod schema for a given command, or null if no schema is defined.
 */
export function getCommandSchema(baseCmd: string): z.ZodType | null {
  return COMMAND_ALLOWLIST[baseCmd.toLowerCase()] ?? null;
}

/**
 * Validates command arguments against the COMMAND_ALLOWLIST schema.
 *
 * - If command has no schema (null): returns { valid: true }
 * - If command has a schema: parses args and validates, returns result
 *
 * The args are parsed as key=value pairs (e.g., "status" → { cmd: "status" })
 * or key=value pairs (e.g., "run build" → { command: "run", script: "build" })
 */
export function validateCommandArgs(
  baseCmd: string,
  args: string[]
): { valid: true } | { valid: false; error: string } {
  const schema = getCommandSchema(baseCmd);
  if (schema === null) {
    return { valid: true };
  }

  // Parse args into an object based on the schema
  // For git: first arg is the subcommand (cmd)
  // For npm/bun/pnpm/yarn: first arg is command, rest is args
  const lowerCmd = baseCmd.toLowerCase();

  let parsedArgs: Record<string, unknown>;

  if (lowerCmd === 'git') {
    // git: "git status" → { cmd: "status" }
    // git: "git commit -m 'msg'" → { cmd: "commit" } (flags ignored for now)
    const cmd = args[0] || '';
    parsedArgs = { cmd };
  } else if (['npm', 'pnpm', 'yarn'].includes(lowerCmd)) {
    // npm: "npm run build" → { command: "run", args: "build" }
    // npm: "npm install --legacy-peer-deps" → { command: "install", args: "--legacy-peer-deps" }
    const command = args[0] || '';
    const restArgs = args.slice(1).join(' ');
    parsedArgs = {
      command,
      ...(restArgs ? { args: restArgs } : {}),
    };
  } else if (lowerCmd === 'bun') {
    // bun: "bun run build" → { command: "run", script: "build" }
    // bun: "bun test" → { command: "test" }
    const command = args[0] || '';
    const restArgs = args.slice(1).join(' ');
    parsedArgs = {
      command,
      ...(restArgs ? { script: restArgs } : {}),
    };
  } else {
    // Generic fallback — shouldn't reach here for commands with schemas
    parsedArgs = {};
  }

  const result = schema.safeParse(parsedArgs);
  if (result.success) {
    return { valid: true };
  }

  // Format error message
  const issues = result.error.issues.map(issue => issue.message).join('; ');
  return { valid: false, error: issues };
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
