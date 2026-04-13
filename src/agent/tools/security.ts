import * as path from 'path';

// Workspace root - can be overridden via environment variable or defaults to process.cwd()
const getWorkspaceRoot = (): string => {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
};

// Rejected home directory paths (~ expansion is NOT done by Node.js path.resolve)
const HOME_PATH_PATTERN = /^~|.*\/~/;

/**
 * Validates that a file path is within the workspace root.
 * Rejects home directory paths and paths outside workspace.
 * 
 * @param filePath - The path to validate
 * @returns Validation result with success status and optional error message
 */
export function validatePath(filePath: string): { valid: boolean; error?: string } {
  const workspaceRoot = getWorkspaceRoot();
  const resolvedPath = path.resolve(filePath);
  const normalizedWorkspace = path.resolve(workspaceRoot) + path.sep;

  // Reject home directory paths
  if (HOME_PATH_PATTERN.test(filePath) || resolvedPath.includes('/~')) {
    return {
      valid: false,
      error: `Access denied. Home directory paths are not allowed: ${filePath}`,
    };
  }

  // Check if resolved path is within workspace root
  if (!resolvedPath.startsWith(normalizedWorkspace)) {
    return {
      valid: false,
      error: `Access denied. Path is outside workspace: ${filePath}`,
    };
  }

  return { valid: true };
}

// Allowed commands whitelist
const ALLOWED_COMMANDS = new Set([
  'git',
  'npm',
  'bun',
  'node',
  'npx',
  'pnpm',
  'yarn',
  'python',
  'python3',
  'pip',
  'pip3',
  'uv',
  'cargo',
  'rustc',
  'go',
  'make',
  'cmake',
  'docker',
  'docker-compose',
  'kubectl',
  'helm',
  'terraform',
  'ansible',
  'curl',
  'wget',
]);

/**
 * Validates that a command is in the allowed whitelist.
 * Extracts the base command from the input string.
 * 
 * @param command - The command string to validate
 * @returns Validation result with success status and optional error message
 */
export function validateCommand(command: string): { valid: boolean; error?: string } {
  const trimmed = command.trim();
  
  // Extract the base command (first word/token)
  const baseCommand = trimmed.split(/\s+/)[0];
  
  // Check if the base command is in the whitelist
  if (!ALLOWED_COMMANDS.has(baseCommand)) {
    return {
      valid: false,
      error: `Command not allowed: '${baseCommand}'. Allowed commands: ${Array.from(ALLOWED_COMMANDS).sort().join(', ')}`,
    };
  }

  return { valid: true };
}
