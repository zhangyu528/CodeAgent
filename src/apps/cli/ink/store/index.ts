/**
 * Store exports
 *
 * New unified store: useChatStore (session + messages combined)
 * Legacy stores: useSessionStore, useMessageStore (kept for migration)
 */

// Zod Schemas
export {
  ChatMessageBlockSchema,
  ChatMessageSchema,
  ChatSessionInfoSchema,
  MessageStoreStateSchema,
  ChatMessagePartialSchema,
  type ChatMessageBlock,
  type ChatMessage,
  type ChatSessionInfo,
  type MessageStoreState,
  type ChatMessagePartial,
} from './schemas.js';

// New unified store
export { useChatStore, createSessionId } from './chatStore.js';

// Legacy stores - for backward compatibility during migration
export { useSessionStore, createSessionId as createSessionIdLegacy } from './sessionStore.js';
export { useMessageStore } from './messageStore.js';
