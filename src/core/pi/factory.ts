import { registerBuiltInApiProviders, getModel, getModels } from '@mariozechner/pi-ai';
import { Agent, AgentTool } from '@mariozechner/pi-agent-core';
import { allTools } from './tools/index.js';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

// Provider overrides (all config via env: {PROVIDER}_API, {PROVIDER}_BASE_URL)
const PROVIDER_OVERRIDES: Record<string, { baseUrl?: string; api?: string }> = {
  minimax: {},
};

let initialized = false;

export async function createPiAgent(): Promise<Agent> {
  if (!initialized) {
    registerBuiltInApiProviders();
    initialized = true;
  }

  const agent = new Agent({
    getApiKey: (provider: string) => {
      const envVar = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
      return process.env[envVar];
    },
  });

  agent.setTools(allTools as unknown as AgentTool<any, any>[]);

  // Default model from pi-ai registry (uses DEFAULT_PROVIDER and *_MODEL env vars)
  // If no valid configuration in .env, don't set any model - let user choose
  const provider = process.env.DEFAULT_PROVIDER;
  const envModelKey = provider ? `${provider.toUpperCase().replace(/-/g, '_')}_MODEL` : null;
  const modelId = envModelKey ? process.env[envModelKey] : null;
  const model = (provider && modelId) ? getModel(provider as any, modelId as any) : null;

  // If model not found, use first available model from the provider
  const availableModels = provider ? getModels(provider as any) : [];
  const firstModel = availableModels.length > 0 ? availableModels[0] : null;
  const finalModelData = model || firstModel;

  // Apply provider overrides if needed
  const override = provider ? PROVIDER_OVERRIDES[provider] : undefined;
  const providerUpper = provider ? provider.toUpperCase().replace(/-/g, '_') : '';
  const baseUrlFromEnv = providerUpper ? `${providerUpper}_BASE_URL` : '';
  const apiFromEnv = providerUpper ? `${providerUpper}_API` : '';
  const envBaseUrl = baseUrlFromEnv ? process.env[baseUrlFromEnv] : undefined;
  const envApi = apiFromEnv ? process.env[apiFromEnv] : undefined;
  const finalModel = finalModelData
    ? (override
      ? { ...finalModelData, api: envApi || override.api || finalModelData.api, baseUrl: envBaseUrl || override.baseUrl || finalModelData.baseUrl }
      : { ...finalModelData, api: envApi || finalModelData.api, baseUrl: envBaseUrl || finalModelData.baseUrl })
    : null;

  if (finalModel) {
    agent.setModel(finalModel as any);
  } else {
    // Clear hardcoded default model when no valid configuration
    agent.setModel(null as any);
  }

  return agent;
}

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
