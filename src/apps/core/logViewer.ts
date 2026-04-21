/**
 * Log viewer window management — opens a PowerShell window that tails the daily log file.
 * The window auto-closes when closeLogViewer() is called.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

function getLogPath(): string {
  return join(homedir(), '.codeagent', 'logs', 'codeagent.log');
}

function getPidFile(): string {
  return join(homedir(), '.codeagent', 'logs', 'logviewer.pid');
}

function ensureLogDir(): void {
  const logDir = join(homedir(), '.codeagent', 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Open a PowerShell window that tails the daily log file.
 * The PowerShell window PID is written to a pid file for later cleanup.
 */
export function openLogViewer(): void {
  ensureLogDir();
  const logPath = getLogPath();
  const pidFile = getPidFile();

  // PowerShell writes its own PID to file so we can kill it later
  const psCmd =
    `while (!(Test-Path '${logPath}')) { Start-Sleep -Milliseconds 200 }; ` +
    `$pid | Out-File -FilePath '${pidFile}' -Encoding UTF8; ` +
    `Get-Content -Path '${logPath}' -Wait -Encoding UTF8`;

  spawn('cmd', ['/c', 'start', 'Log Viewer', 'powershell', '-NoExit', '-Command', psCmd], {
    detached: true,
    stdio: 'ignore',
    shell: false,
  });
}

/**
 * Kill the log viewer window using the PID saved in the pid file.
 */
export function closeLogViewer(): void {
  const pidFile = getPidFile();
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    if (pid && !isNaN(pid)) {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false });
    }
  } catch {
    // pid file not ready yet, ignore
  }
  try {
    unlinkSync(pidFile);
  } catch {
    // ignore
  }
}
