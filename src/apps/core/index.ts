/**
 * Core Module
 * Session management, auth, and model discovery for the CodeAgent application
 */

// Session management
export { getAgentSession, ensureAgentInitialized } from './agent.js';

// Auth helpers (API key management via AuthStorage)
export {
  saveApiKey,
  removeApiKey,
  checkApiKeyConfigured,
  isFirstRun,
  getAuthStorage,
} from './apiKey.js';

// Model discovery
export {
  ensureProvidersLoaded,
  getProviders,
  getModels,
  clearProviderCache,
  reloadProviders,
} from './modelDiscovery.js';

// Re-export types from pi-coding-agent for use by apps layer
export type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent';
