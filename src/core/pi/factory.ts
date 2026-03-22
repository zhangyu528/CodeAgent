import { registerBuiltInApiProviders } from '@mariozechner/pi-ai';
import { Agent, AgentTool } from '@mariozechner/pi-agent-core';
import { allTools } from './tools/index.js';

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
  
  // Default model configuration from .env
  const provider = process.env.DEFAULT_PROVIDER || 'openai';
  const modelId = process.env.OPENAI_MODEL || 'gpt-4o';
  
  agent.setModel({
    id: modelId,
    name: modelId,
    provider: provider,
    api: provider === 'openai' ? 'openai-responses' : 'anthropic-messages',
  } as any);

  return agent;
}
