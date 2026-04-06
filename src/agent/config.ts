/**
 * Environment Configuration Helpers
 * Handles model config and API key persistence to .env file
 */
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

/**
 * Save the selected provider and model to .env file for persistence
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
    
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('='); // handle values containing =
    
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
 */
export function checkApiKeyConfigured(provider: string): boolean {
  const envVar = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  return !!process.env[envVar];
}

/**
 * Save API key to .env file for persistence
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

    const [key, ...valueParts] = line.split('=');

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
