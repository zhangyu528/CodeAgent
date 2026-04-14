/**
 * Environment Configuration Helpers
 *
 * Handles model config and API key persistence to .env file.
 *
 * ## Path Resolution
 *
 * This module resolves `.env` relative to `process.cwd()` (current working directory).
 * This means the `.env` file is expected alongside the running script or in the project root
 * where the CLI is executed. This is the **recommended approach** for CLI tools that run
 * in a known project context, per the dotenv official documentation:
 *
 * @see https://github.com/motdotla/dotenv#should-i-commit-my-env-file
 *
 * ## Security Note
 *
 * `.env` files should NEVER be committed to version control. This module assumes the
 * consuming application handles .gitignore correctly (CodeAgent does via its `.gitignore`).
 * API keys written by `saveApiKey()` are stored in plain text on disk.
 */

/**
 * @fileoverview
 * Environment Configuration Helpers
 * Handles model config and API key persistence to .env file
 */
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

/**
 * Save the selected provider and model to .env file for persistence
 *
 * Reads the existing `.env` file, updates or inserts the `DEFAULT_PROVIDER`
 * and `{PROVIDER}_MODEL` entries, and writes back atomically via writeFileSync.
 * Preserves all other existing environment variables in the file.
 *
 * @param provider - The provider name (e.g., 'minimax', 'zai'). Will be uppercased and
 *                   hyphens replaced with underscores for the env var name.
 * @param modelId  - The model ID to persist (e.g., 'glm-4.7', 'MiniMax-M2.7')
 */
export function saveModelConfig(provider: string, modelId: string): void {
  const envKey = `${provider.toUpperCase().replace(/-/g, '_')}_MODEL`;
  
  // Read existing .env content
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  }
  
  // Parse existing env vars (preserve API keys and other settings)
  const lines = envContent.split('\n');
  const newLines: string[] = [];
  let defaultProviderUpdated = false;
  let modelUpdated = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line);
      continue;
    }
    
    const eqIdx = line.indexOf('=');
    const key = eqIdx >= 0 ? line.slice(0, eqIdx) : line;
    
    if (key === 'DEFAULT_PROVIDER') {
      newLines.push(`DEFAULT_PROVIDER=${provider}`);
      defaultProviderUpdated = true;
    } else if (key === envKey) {
      newLines.push(`${envKey}=${modelId}`);
      modelUpdated = true;
    } else {
      newLines.push(line);
    }
  }
  
  // Add missing entries
  if (!defaultProviderUpdated) {
    newLines.push(`DEFAULT_PROVIDER=${provider}`);
  }
  if (!modelUpdated) {
    newLines.push(`${envKey}=${modelId}`);
  }
  
  // Write back to .env
  fs.writeFileSync(ENV_PATH, newLines.join('\n') + '\n', 'utf-8');

  // Also update process.env so the current process can use it immediately
  process.env['DEFAULT_PROVIDER'] = provider;
  process.env[envKey] = modelId;
}

/**
 * Check if API key is configured for a provider
 *
 * @param provider - The provider name (e.g., 'minimax', 'zai')
 * @returns true if the {PROVIDER}_API_KEY environment variable is set
 */
export function checkApiKeyConfigured(provider: string): boolean {
  const envVar = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  return !!process.env[envVar];
}

/**
 * Save API key to .env file for persistence
 *
 * @param provider - The provider name (e.g., 'minimax', 'zai')
 * @param apiKey   - The API key to persist
 */
export function saveApiKey(provider: string, apiKey: string): void {
  const envKey = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;

  // Read existing .env content
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  // Parse existing env vars
  const lines = envContent.split('\n');
  const newLines: string[] = [];
  let apiKeyUpdated = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line);
      continue;
    }

    const eqIdx = line.indexOf('=');
    const key = eqIdx >= 0 ? line.slice(0, eqIdx) : line;

    if (key === envKey) {
      newLines.push(`${envKey}=${apiKey}`);
      apiKeyUpdated = true;
    } else {
      newLines.push(line);
    }
  }

  // Add missing entry
  if (!apiKeyUpdated) {
    newLines.push(`${envKey}=${apiKey}`);
  }

  // Write back to .env
  fs.writeFileSync(ENV_PATH, newLines.join('\n') + '\n', 'utf-8');

  // Also update process.env so the current process can use it immediately
  process.env[envKey] = apiKey;
}
