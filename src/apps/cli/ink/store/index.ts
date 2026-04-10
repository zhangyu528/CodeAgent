/**
 * Store exports
 * 
 * New unified store: useChatStore (session + messages combined)
 * Legacy stores: useSessionStore, useMessageStore (kept for migration)
 */

// New unified store
export { useChatStore, createSessionId } from './chatStore.js';

// Legacy stores - for backward compatibility during migration
// TODO: Remove after full migration to useChatStore
export { useSessionStore, createSessionId as createSessionIdLegacy } from './sessionStore.js';
export { useMessageStore } from './messageStore.js';
