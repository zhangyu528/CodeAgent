import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export interface CommandCheckResult {
  isAllowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export interface SecurityLayerOptions {
  blockedCommands?: string[];
  reviewCommands?: string[];
}

export class SecurityLayer {
  private allowedWorkspace: string;
  private blockedCommands: string[];
  private reviewCommands: string[];

  constructor(workspacePath: string, options?: SecurityLayerOptions) {
    this.allowedWorkspace = path.resolve(workspacePath);
    this.blockedCommands = options?.blockedCommands ?? ["rm -rf", "mkfs", "dd", "shutdown", "reboot", "halt"];
    this.reviewCommands =
      options?.reviewCommands ?? ["rm", "chmod", "chown", "mv", "cp", "curl", "wget", "git push", "npm publish"];
  }

  validatePath(targetPath: string): boolean {
    const resolved = path.resolve(this.allowedWorkspace, targetPath);
    return resolved.startsWith(this.allowedWorkspace);
  }

  validateCommand(cmd: string, args: string[]): CommandCheckResult {
    const normalized = [cmd, ...args].join(" ").trim().toLowerCase();

    for (const blocked of this.blockedCommands) {
      if (normalized.startsWith(blocked)) {
        return { isAllowed: false, requiresApproval: false, reason: `Blocked command: ${blocked}` };
      }
    }

    for (const review of this.reviewCommands) {
      if (normalized.startsWith(review)) {
        return { isAllowed: true, requiresApproval: true, reason: `Review required for: ${review}` };
      }
    }

    return { isAllowed: true, requiresApproval: false };
  }

  async requestUserApproval(actionDescription: string): Promise<boolean> {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(`${actionDescription} (y/n): `);
    rl.close();
    return answer.trim().toLowerCase().startsWith("y");
  }
}
