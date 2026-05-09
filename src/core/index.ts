/**
 * Core Module
 * Session management, auth, and model discovery for the CodeAgent application
 */

// Session management
export {
  ensureAgentInitialized,
  getAgent,
  getAgentSession,
  hasActiveSession,
  activateProject,
  activateSession,
  registerProject,
  unregisterProject,
  renameProjectByPath,
  newSession,
  renameSession,
  deleteSession,
  listAllSessions,
  newGlobalSession,
  subscribeToActiveSession,
  getActiveCwd,
  getSessionId,
  getSessionName,
  setSessionName,
  getSessionMessages,
  getSessionFile,
  getContextUsage,
  setModel,
  compact,
  setAutoCompaction,
  abort,
  exportSession,
  prompt,
} from './agent.js';
export { getSessionManager, listSessions } from './sessionManager.js';
export {
  listProjects,
  getProject,
  addProject,
  removeProject,
  renameProject,
  getOrCreateDefaultProject,
} from './projects.js';
export type { ProjectInfo } from './projects.js';

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

// Logger
export { logger } from './logger.js';

// Re-export types from pi-coding-agent for use by apps layer
export type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent';
