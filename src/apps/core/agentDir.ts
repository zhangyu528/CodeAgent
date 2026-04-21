/**
 * CodeAgent directory paths
 * Storage base: ~/.codeagent
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function ensureCodeAgentDir(): string {
  const dir = join(homedir(), '.codeagent');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getCodeAgentDir(): string {
  return ensureCodeAgentDir();
}
