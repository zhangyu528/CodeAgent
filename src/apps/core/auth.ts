/**
 * Auth API - facade for agent's AuthStorage
 * Storage path: determined by agentDir (default: ~/.codeagent)
 */

import { AuthStorage } from '@mariozechner/pi-coding-agent';
import { logger } from './logger.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getCodeAgentDir } from './agentDir.js';

let authStorageInstance: AuthStorage | null = null;

export function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) {
    authStorageInstance = AuthStorage.create();
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
 */
export function saveApiKey(provider: string, apiKey: string): void {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }
  if (apiKey.length < 8) {
    throw new Error('API key is too short (minimum 8 characters)');
  }
  if (/[\x00-\x1F\x7F]/.test(apiKey)) {
    throw new Error('API key contains invalid control characters');
  }

  getAuthStorage().set(provider, { type: 'api_key', key: apiKey });
  logger.info(`[Auth] API key saved for provider: ${provider}`);
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

  const sessionsDir = join(getCodeAgentDir(), 'sessions');
  if (existsSync(sessionsDir)) {
    const files = readdirSync(sessionsDir).filter((f: string) => f.endsWith('.json'));
    if (files.length > 0) return false;
  }

  return true;
}
