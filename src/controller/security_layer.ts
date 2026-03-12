import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface SecurityCheckResult {
  isSafe: boolean;
  needsApproval: boolean;
  reason?: string;
}

export type ApprovalHandler = (description: string) => Promise<boolean>;

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(p => Number(p));
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined) return false;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT

  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === '::1') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local
  if (h.startsWith('fe80')) return true; // link-local
  return false;
}

function looksLikeIpv4(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

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

  private webSensitivePatterns: (string | RegExp)[] = [
    'password',
    'passwd',
    'api_key',
    'apikey',
    'secret',
    'credential',
    'bearer ',
    'private key',
    'ssh-rsa',
    'token=',
    'access_token',
    'refresh_token',
    '密钥',
    '密码',
    /-----begin [a-z0-9 ]*private key-----/i,
  ];

  private approvalHandler?: ApprovalHandler | undefined;

  constructor(workspaceRoot: string, approvalHandler?: ApprovalHandler) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.approvalHandler = approvalHandler;
  }

  /**
   * Checks if the current workspace is trusted.
   */
  async isWorkspaceTrusted(): Promise<boolean> {
    const configPath = this.getGlobalConfigPath();
    if (!fs.existsSync(configPath)) return false;

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const trustedPaths: string[] = config.trustedWorkspaces || [];
      return trustedPaths.includes(this.workspaceRoot);
    } catch {
      return false;
    }
  }

  /**
   * Adds the current workspace to the trusted list.
   */
  async grantWorkspaceTrust(): Promise<void> {
    const configPath = this.getGlobalConfigPath();
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let config: any = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {
        config = {};
      }
    }

    const trustedPaths: string[] = config.trustedWorkspaces || [];
    if (!trustedPaths.includes(this.workspaceRoot)) {
      trustedPaths.push(this.workspaceRoot);
    }

    config.trustedWorkspaces = trustedPaths;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  private getGlobalConfigPath(): string {
    // Allow tests / restricted environments to override config location
    const override = (process.env.CODEAGENT_CONFIG_PATH || '').trim();
    if (override) return path.resolve(override);

    const homeOverride = (process.env.CODEAGENT_HOME || '').trim();
    if (homeOverride) return path.join(path.resolve(homeOverride), 'config.json');

    return path.join(os.homedir(), '.codeagent', 'config.json');
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
   * Web text check (query/url text): flags sensitive patterns for HITL.
   */
  checkWebText(text: string): SecurityCheckResult {
    const t = (text || '').toLowerCase();
    for (const p of this.webSensitivePatterns) {
      if (typeof p === 'string') {
        if (t.includes(p)) {
          return { isSafe: true, needsApproval: true, reason: `Web text contains sensitive pattern: "${p}"` };
        }
      } else {
        if (p.test(text || '')) {
          return { isSafe: true, needsApproval: true, reason: `Web text matches sensitive pattern: ${p.toString()}` };
        }
      }
    }
    return { isSafe: true, needsApproval: false };
  }

  /**
   * URL security check (SSRF guard). Blocks localhost/private IPs and non-http(s) schemes.
   */
  checkUrl(url: string): SecurityCheckResult {
    const raw = String(url || '').trim();
    if (!raw) return { isSafe: false, needsApproval: false, reason: 'URL is empty' };
    if (raw.length > 2048) return { isSafe: false, needsApproval: false, reason: 'URL is too long' };

    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return { isSafe: false, needsApproval: false, reason: 'Invalid URL' };
    }

    const protocol = u.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { isSafe: false, needsApproval: false, reason: `Disallowed URL scheme: ${protocol}` };
    }

    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) {
      return { isSafe: false, needsApproval: false, reason: 'Localhost is not allowed' };
    }
    if (host.endsWith('.local') || host.endsWith('.internal')) {
      return { isSafe: false, needsApproval: false, reason: 'Local/internal domains are not allowed' };
    }

    if (looksLikeIpv4(host)) {
      if (isPrivateIpv4(host)) {
        return { isSafe: false, needsApproval: false, reason: `Private IPv4 is not allowed: ${host}` };
      }
    } else if (host.includes(':') && isPrivateIpv6(host)) {
      return { isSafe: false, needsApproval: false, reason: `Private IPv6 is not allowed: ${host}` };
    }

    if (u.port) {
      const port = Number(u.port);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        return { isSafe: false, needsApproval: false, reason: `Invalid port: ${u.port}` };
      }
      if (port !== 80 && port !== 443) {
        return { isSafe: true, needsApproval: true, reason: `Non-standard port requires approval: ${port}` };
      }
    }

    return { isSafe: true, needsApproval: false };
  }

  /**
   * Request user approval for a sensitive action.
   */
  async requestApproval(description: string): Promise<boolean> {
    if (!this.approvalHandler) {
      console.warn('[SecurityLayer] Approval required but no handler configured. Denying by default.');
      return false;
    }
    return this.approvalHandler(description);
  }
}




