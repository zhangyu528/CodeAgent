import { registerBuiltInApiProviders, getModel } from '@mariozechner/pi-ai';
import { Agent, AgentTool } from '@mariozechner/pi-agent-core';
import { allTools } from './tools/index.js';

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
  const provider = process.env.DEFAULT_PROVIDER || 'minimax';
  const envModelKey = `${provider.toUpperCase().replace(/-/g, '_')}_MODEL`;
  const modelId = process.env[envModelKey] || provider;
  const model = getModel(provider as any, modelId as any);

  // Apply provider overrides if needed
  const override = PROVIDER_OVERRIDES[provider];
  const providerUpper = provider.toUpperCase().replace(/-/g, '_');
  const baseUrlFromEnv = `${providerUpper}_BASE_URL`;
  const apiFromEnv = `${providerUpper}_API`;
  const envBaseUrl = process.env[baseUrlFromEnv];
  const envApi = process.env[apiFromEnv];
  const finalModel = override
    ? { ...model, api: envApi || override.api || model.api, baseUrl: envBaseUrl || model.baseUrl }
    : { ...model, api: envApi || model.api, baseUrl: envBaseUrl || model.baseUrl };
  agent.setModel(finalModel as any);

  return agent;
}
