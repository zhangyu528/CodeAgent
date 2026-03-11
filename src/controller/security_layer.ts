import * as path from 'path';

export interface SecurityCheckResult {
  isSafe: boolean;
  needsApproval: boolean;
  reason?: string;
}

export type ApprovalHandler = (description: string) => Promise<boolean>;

export class SecurityLayer {
  private workspaceRoot: string;
  private blockedPatterns: string[] = [
    'rm -rf /',
    'rm -rf *',
    'format',
    'mkfs',
    'shutdown',
    'reboot',
    '> /dev/',
    'chmod -R 777 /',
  ];

  private sensitivePatterns: string[] = [
    'rm ',
    'npm install',
    'npm i ',
    'yarn add',
    'pnpm add',
    'sudo ',
    'curl ',
    'wget ',
    '> ',
    '>> ',
  ];

  private approvalHandler?: ApprovalHandler | undefined;

  constructor(workspaceRoot: string, approvalHandler?: ApprovalHandler) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.approvalHandler = approvalHandler;
  }

  /**
   * Verifies if a file path is within the allowed workspace.
   */
  validatePath(targetPath: string): boolean {
    const resolvedPath = path.resolve(this.workspaceRoot, targetPath);
    return resolvedPath.startsWith(this.workspaceRoot);
  }

  /**
   * Checks a shell command for dangerous or sensitive patterns.
   */
  checkCommand(command: string): SecurityCheckResult {
    const lowerCmd = command.toLowerCase();

    // 1. Check for blocked patterns (Hard block)
    for (const pattern of this.blockedPatterns) {
      if (lowerCmd.includes(pattern)) {
        return {
          isSafe: false,
          needsApproval: false,
          reason: `Command contains blocked pattern: "${pattern}"`
        };
      }
    }

    // 2. Check for sensitive patterns (Requires approval if handler exists)
    for (const pattern of this.sensitivePatterns) {
      if (lowerCmd.includes(pattern)) {
        return {
          isSafe: true,
          needsApproval: true,
          reason: `Command contains sensitive pattern: "${pattern}"`
        };
      }
    }

    return { isSafe: true, needsApproval: false };
  }

  /**
   * Request user approval for a sensitive action.
   */
  async requestApproval(description: string): Promise<boolean> {
    if (!this.approvalHandler) {
      // If no handler (e.g., in automated tests), we might want to fail-closed or fail-open.
      // For MVP, if HITL is required but no handler exists, we'll be cautious and deny.
      console.warn('[SecurityLayer] Approval required but no handler configured. Denying by default.');
      return false;
    }
    return this.approvalHandler(description);
  }
}
