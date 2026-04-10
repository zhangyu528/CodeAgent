/**
 * ChatStore - Unified store for session and message state
 * 
 * Session and Messages are part of the same aggregate (a Session contains Messages).
 * Keeping them in one store:
 * - Eliminates cross-store coordination
 * - Makes clearSession() work atomically on all related state
 * - Reflects the true business model
 */
import { create } from 'zustand';
import { getAgent } from '../../../../agent/index.js';
import { sessionManager, SessionInfo, SessionStatus } from '../../../../agent/sessions.js';
import { ChatSessionInfo, ChatMessage } from '../pages/types.js';
import { agentMessagesToChatMessages } from '../utils/messageAdapters.js';

// ============================================================================
// Helpers
// ============================================================================

export function createSessionId(): string {
  try {
    const { randomUUID } = require('crypto') as { randomUUID: () => string };
    return randomUUID();
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function extractSessionTitle(text: string): string {
  const normalized = (text || '').trim();
  if (!normalized) return 'New Session';
  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

// ============================================================================
// Types
// ============================================================================

interface ChatStore {
  // Session State
  historyItems: SessionInfo[];
  currentSession: ChatSessionInfo | null;
  activeSessionId: string | null;
  pendingPrompt: string | null;

  // Message State
  messages: ChatMessage[];
  thinking: boolean;
  usage: { input: number; output: number; cost: number } | null;

  // Session Actions
  refreshHistory: (limit?: number) => Promise<SessionInfo[]>;
  persistCurrentSession: (status?: SessionStatus, messages?: any[]) => void;
  restoreSessionById: (sessionId: string) => Promise<boolean>;
  ensureSessionForPrompt: (userInput: string) => string;

  // Pending Prompt Actions
  setPendingPrompt: (prompt: string | null) => void;
  getAndClearPendingPrompt: () => string | null;

  // Message Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (update: (msg: ChatMessage) => ChatMessage) => void;

  // Combined Actions
  /**
   * Clears all session and message state.
   * This is an atomic operation - either everything is cleared or nothing.
   */
  clearAll: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial Session State
  historyItems: [],
  currentSession: null,
  activeSessionId: null,
  pendingPrompt: null,

  // Initial Message State
  messages: [],
  thinking: false,
  usage: null,

  // Session Actions
  refreshHistory: async (limit?: number) => {
    const history = await sessionManager.getHistory(limit ?? 50);
    set({ historyItems: history });
    return history;
  },

  persistCurrentSession: (status: SessionStatus = 'completed', messages?: any[]) => {
    const { activeSessionId, currentSession } = get();
    if (!activeSessionId) return;

    const agent = getAgent();
    agent.sessionId = activeSessionId;

    const title = currentSession?.id === activeSessionId ? currentSession.title : null;
    const messagesToUse = messages || [];

    set(prev => ({
      currentSession: prev.activeSessionId === activeSessionId && prev.currentSession ? {
        ...prev.currentSession,
        status,
        updatedAt: Date.now(),
        messageCount: messagesToUse.length,
        title: prev.currentSession.title || extractSessionTitle(messagesToUse[0]?.content || ''),
      } : prev.currentSession,
    }));

    void sessionManager
      .saveSession(activeSessionId, agent.state.messages, {
        status,
        model: agent.state.model?.id,
        provider: agent.state.model?.provider,
        ...(title ? { title } : {}),
      })
      .then(() => {
        void get().refreshHistory();
      })
      .catch(() => {});
  },

  restoreSessionById: async (sessionId: string) => {
    const record = await sessionManager.loadSession(sessionId);
    if (!record) return false;

    const agent = getAgent();
    agent.sessionId = record.id;
    agent.replaceMessages(record.messages);

    // Restore both session state and messages atomically
    set({
      activeSessionId: record.id,
      currentSession: {
        id: record.id,
        title: record.title || 'Untitled Session',
        status: record.meta.status,
        updatedAt: record.meta.updatedAt,
        messageCount: record.messages?.length || 0,
      },
      messages: agentMessagesToChatMessages(record.messages),
    });

    return true;
  },

  ensureSessionForPrompt: (userInput: string) => {
    const { activeSessionId, currentSession } = get();
    const agent = getAgent();

    if (activeSessionId) {
      agent.sessionId = activeSessionId;
      if (!currentSession) {
        set({
          currentSession: {
            id: activeSessionId,
            title: extractSessionTitle(userInput),
            status: 'active',
            updatedAt: Date.now(),
            messageCount: 1,
          },
        });
      }
      return activeSessionId;
    }

    const newSessionId = createSessionId();
    agent.sessionId = newSessionId;
    set({
      activeSessionId: newSessionId,
      currentSession: {
        id: newSessionId,
        title: extractSessionTitle(userInput),
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 1,
      },
    });
    return newSessionId;
  },

  // Pending Prompt Actions
  setPendingPrompt: (prompt: string | null) => {
    set({ pendingPrompt: prompt });
  },

  getAndClearPendingPrompt: () => {
    const { pendingPrompt } = get();
    set({ pendingPrompt: null });
    return pendingPrompt;
  },

  // Message Actions
  setMessages: (messages) => set({ messages }),

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  updateLastMessage: (update) => set((state) => {
    if (state.messages.length === 0) return state;
    const newMessages = [...state.messages];
    newMessages[newMessages.length - 1] = update(newMessages[newMessages.length - 1]);
    return { messages: newMessages };
  }),

  // Combined Actions
  clearAll: () => {
    const agent = getAgent();
    agent.replaceMessages([]);
    set({
      activeSessionId: null,
      currentSession: null,
      pendingPrompt: null,
      messages: [],
      thinking: false,
      usage: null,
    });
  },
}));
