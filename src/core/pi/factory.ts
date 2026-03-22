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
  const provider = process.env.DEFAULT_PROVIDER || 'glm';
  const envModelKey = `${provider.toUpperCase().replace(/-/g, '_')}_MODEL`;
  const modelId = process.env[envModelKey] || (provider === 'glm' ? 'glm-4-flash' : 'gpt-4o');
  
  let api = 'openai-responses';
  let baseUrl: string | undefined = undefined;

  switch (provider) {
    case 'openai':
      api = 'openai-responses';
      break;
    case 'anthropic':
      api = 'anthropic-messages';
      break;
    case 'glm':
      api = 'openai-responses';
      baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/';
      break;
    case 'minimax':
      api = 'openai-responses';
      baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1/';
      break;
    default:
      api = 'openai-responses';
  }

  agent.setModel({
    id: modelId,
    name: modelId,
    provider: provider,
    api: api,
    baseUrl: baseUrl,
  } as any);

  return agent;
}
