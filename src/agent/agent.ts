/**
 * Agent - Singleton & Factory
 * Creates and manages the Agent singleton instance
 */
import { registerBuiltInApiProviders } from '@mariozechner/pi-ai';
import { Agent } from '@mariozechner/pi-agent-core';
import { allTools } from './tools/index.js';
import { modelResolver } from './model.js';

// ============================================================================
// Singleton Management
// ============================================================================
let agentInstance: Agent | null = null;
let initialized = false;

function initAgent(): Agent {
  if (agentInstance) {
    console.warn('[Agent] Already initialized, ignoring second init');
    return agentInstance;
  }

  if (!initialized) {
    registerBuiltInApiProviders();
    initialized = true;
  }

  agentInstance = new Agent({
    getApiKey: (provider: string) => {
      const envVar = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
      return process.env[envVar];
    },
  });

  agentInstance.setTools(allTools as any);

  const model = modelResolver.resolve();
  if (model) {
    agentInstance.setModel(model);
  }

  return agentInstance;
}

export function getAgent(): Agent {
  if (!agentInstance) {
    agentInstance = initAgent();
  }
  return agentInstance;
}
