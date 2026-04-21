/**
 * Logger utility using Consola
 * - Dev: console + file output (file for log viewer)
 * - Prod: file output in ~/.codeagent/logs/codeagent.log
 */

import { createConsola, LogLevels } from 'consola';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const isDev = process.env.NODE_ENV !== 'production';
// Use POSITIVE_INFINITY so all log levels (including info=3) pass through
// Consola's _logFn checks: (defaults.level || 0) > this.level → blocked
const LOG_LEVEL_VERBOSE = Number.POSITIVE_INFINITY;

function getLogDir(): string {
  return join(homedir(), '.codeagent', 'logs');
}

function ensureLogDir(): string {
  const dir = getLogDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getLogFile(): string {
  const dir = ensureLogDir();
  return join(dir, 'codeagent.log');
}

function createFileReporter(filepath: string) {
  return {
    // Consola 3.x passes [logObj, options] — use ...args to capture all
    log(...args: unknown[]) {
      const logObj = args[0] as { date: Date; level: number; args: unknown[]; type: string };
      const levelKeys = Object.keys(LogLevels).filter(
        k => typeof (LogLevels as Record<string, unknown>)[k] === 'number'
      );
      const levelName = (
        levelKeys.find(k => (LogLevels as Record<string, number>)[k] === logObj.level) ?? 'INFO'
      ).toUpperCase();
      const timestamp = logObj.date.toLocaleString('zh-CN');
      const message = logObj.args
        .map(a =>
          a instanceof Error
            ? `${a.message}\n${a.stack}`
            : typeof a === 'object'
              ? JSON.stringify(a)
              : String(a)
        )
        .join(' ');
      const line = `[${timestamp}] [${levelName}] ${message}\n`;
      appendFileSync(filepath, line, 'utf-8');
    },
  };
}

let _logger: ReturnType<typeof createConsola> | null = null;

export function getLogger(): ReturnType<typeof createConsola> {
  if (!_logger) {
    ensureLogDir();
    const fileReporter = createFileReporter(getLogFile());

    _logger = createConsola({
      defaults: { tag: 'codeagent' },
      level: LOG_LEVEL_VERBOSE,
      reporters: [fileReporter],
    });
  }
  return _logger;
}

export const logger = getLogger();
