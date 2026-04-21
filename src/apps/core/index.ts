/**
 * Core Module
 * Session management, auth, and model discovery for the CodeAgent application
 */

// Session management
export { ensureAgentInitialized, getAgent, getAgentSession, switchSession, newSession, setModel, getSessionId, getSessionName, setSessionName, getSessionMessages } from './agent.js';
export { getSessionManager, listSessions } from './sessionManager.js';

// Auth helpers (API key management via AuthStorage)
export {
  saveApiKey,
  removeApiKey,
  checkApiKeyConfigured,
  isFirstRun,
  getAuthStorage,
} from './auth.js';

// Settings manager
export { getSettingsManager } from './settingsManager.js';

// Model registry
export {
  getModelRegistry,
  ensureProvidersLoaded,
  getProviders,
  getModels,
  clearProviderCache,
  reloadProviders,
} from './modelRegistry.js';

// Log viewer (dev only — Windows PowerShell window)
export { openLogViewer, closeLogViewer } from './logViewer.js';

// Logger
export { logger } from './logger.js';

// Re-export types from pi-coding-agent for use by apps layer
export type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent';
