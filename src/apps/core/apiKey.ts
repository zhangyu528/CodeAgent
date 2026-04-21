/**
 * Agent Configuration Helpers
 * Uses AuthStorage from pi-coding-agent for API key persistence.
 * Storage path: ~/.codeagent/auth.json
 */

import { AuthStorage } from '@mariozechner/pi-coding-agent';
import { logger } from './logger.js';
import { existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function getCodeAgentDir(): string {
  return join(homedir(), '.codeagent');
}

function ensureCodeAgentDir(): string {
  const dir = getCodeAgentDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the AuthStorage instance for API key management.
 * Creates it lazily on first access.
 * Storage: ~/.codeagent/auth.json
 */
let authStorageInstance: AuthStorage | null = null;

export function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) {
    const dir = ensureCodeAgentDir();
    const authPath = join(dir, 'auth.json');
    authStorageInstance = AuthStorage.create(authPath);
  }
  return authStorageInstance;
}

/**
 * Check if API key is configured for a provider.
 * Uses AuthStorage for persistent API key management.
 */
export function checkApiKeyConfigured(provider: string): boolean {
  const auth = getAuthStorage();
  return auth.has(provider);
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

  const auth = getAuthStorage();
  auth.set(provider, { type: 'api_key', key: apiKey });
  logger.info(`[Auth] API key saved for provider: ${provider}`);
}

/**
 * Remove API key for a provider from AuthStorage.
 */
export function removeApiKey(provider: string): void {
  const auth = getAuthStorage();
  auth.remove(provider);
}

/**
 * Check if this is the first run: no session files AND no configured API keys.
 * Sessions are stored in ~/.codeagent/sessions/ (SDK's default behavior when
 * agentDir is not overridden).
 */
export function isFirstRun(): boolean {
  // No configured API keys
  const auth = getAuthStorage();
  if (auth.list().length > 0) return false;

  // No session files under our codeagent dir
  const sessionsDir = join(getCodeAgentDir(), 'sessions');
  if (existsSync(sessionsDir)) {
    const files = readdirSync(sessionsDir).filter((f: string) => f.endsWith('.json'));
    if (files.length > 0) return false;
  }

  return true;
}
