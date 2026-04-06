/**
 * Agent Module
 * Main exports for the agent package
 */

// Agent singleton & factory
export { getAgent } from './agent.js';

// Config helpers
export { saveModelConfig, saveApiKey, checkApiKeyConfigured } from './config.js';

// Sessions
export { sessionManager } from './sessions.js';
export type { SessionInfo, SessionRecord, SessionStatus } from './sessions.js';
