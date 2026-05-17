/**
 * Backend Module
 * Session management, auth, and model discovery for the CodeAgent application
 */

// Session management
export * from './session/index.js';
export { setAutoCompaction, getAutoCompaction, isCompacting } from './session/pool.js';

// Project management
export * from './project/index.js';

// Auth helpers
export * from './auth/index.js';

// Model and Settings
export * from './model/index.js';

// Re-export types from pi-coding-agent
export type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent';