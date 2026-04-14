/**
 * Agent Module
 * Main exports for the agent package
 */

// Agent singleton & factory
export { getAgent } from './agent.js';

// Config helpers
export { saveModelConfig, saveApiKey, checkApiKeyConfigured } from './config.js';

// Sessions — backward-compat re-export of sessionRepository
export { sessionRepository as sessionManager } from './sessionRepository.js';
export type { SessionInfo, SessionRecord, SessionStatus } from './sessions.js';
