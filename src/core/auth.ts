/**
 * Auth API - facade for agent's AuthStorage
 * Storage path: SDK default (~/.pi/agent/)
 */

import { AuthStorage, getAgentDir } from '@mariozechner/pi-coding-agent';
import { logger } from './logger.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

let authStorageInstance: AuthStorage | null = null;

export function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) {
    const authPath = join(getAgentDir(), 'auth.json');
    authStorageInstance = AuthStorage.create(authPath);
  }
  return authStorageInstance;
}

/**
 * Check if API key is configured for a provider.
 */
export function checkApiKeyConfigured(provider: string): boolean {
  return getAuthStorage().has(provider);
}

/**
 * Save API key to AuthStorage for persistence.
 * Returns true if saved successfully, false if validation failed (key too short, etc).
 * Logs warning instead of throwing to avoid fatal errors in the UI.
 */
export function saveApiKey(provider: string, apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    logger.warn(`[Auth] API key must be a non-empty string for ${provider}`);
    return false;
  }
  if (apiKey.length < 4) {
    logger.warn(`[Auth] API key is too short for ${provider} (minimum 4 characters)`);
    return false;
  }
  if (/[\x00-\x1F\x7F]/.test(apiKey)) {
    logger.warn(`[Auth] API key contains invalid control characters for ${provider}`);
    return false;
  }

  getAuthStorage().set(provider, { type: 'api_key', key: apiKey });
  logger.info(`[Auth] API key saved for provider: ${provider}`);
  return true;
}

/**
 * Remove API key for a provider from AuthStorage.
 */
export function removeApiKey(provider: string): void {
  getAuthStorage().remove(provider);
}

/**
 * Check if this is the first run: no session files AND no configured API keys.
 */
export function isFirstRun(): boolean {
  const auth = getAuthStorage();
  if (auth.list().length > 0) return false;

  const sessionsBase = join(getAgentDir(), 'sessions');
  if (existsSync(sessionsBase)) {
    const dirs = readdirSync(sessionsBase);
    for (const dir of dirs) {
      const dirPath = join(sessionsBase, dir);
      const files = readdirSync(dirPath).filter((f: string) => f.endsWith('.jsonl'));
      if (files.length > 0) return false;
    }
  }

  return true;
}
