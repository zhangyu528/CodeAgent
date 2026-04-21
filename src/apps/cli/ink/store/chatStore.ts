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
import { randomUUID } from 'crypto';
import { getAgentSession } from '@codeagent/core';
import {
  ChatMessageSchema,
  ChatSessionInfoSchema,
  type ChatMessage,
  type ChatSessionInfo,
} from './schemas.js';
import { agentMessagesToChatMessages } from '../utils/messageAdapters.js';

// Re-export common types if needed or use from pi-coding-agent
export type SessionStatus = 'active' | 'completed' | 'error' | 'streaming';

interface SessionInfo {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  status: SessionStatus;
}

// Debounce delay for persistCurrentSession to avoid hammering filesystem
const DEBOUNCE_MS = 500;

// ============================================================================
// Helpers
// ============================================================================

export function createSessionId(): string {
  try {
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
  persistCurrentSession: (status?: SessionStatus, messages?: ChatMessage[]) => void;
  restoreSessionById: (sessionId: string) => Promise<boolean>;
  ensureSessionForPrompt: (userInput: string) => string;

  // Pending Prompt Actions
  setPendingPrompt: (prompt: string | null) => void;
  getAndClearPendingPrompt: () => string | null;

  // Message Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (update: (msg: ChatMessage) => ChatMessage) => void;
  setUsage: (usage: { input: number; output: number; cost: number } | null) => void;

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
  messages: [] as ChatMessage[],
  thinking: false,
  usage: null,

  // Session Actions
  refreshHistory: async (limit?: number) => {
    // SessionManager.list() is a static method: SessionManager.list(cwd, sessionDir?)
    const { SessionManager } = await import('@mariozechner/pi-coding-agent') as any;
    const session = getAgentSession();
    const cwd = (session.sessionManager as any).getCwd?.() ?? process.cwd();
    const allSessions = await SessionManager.list(cwd);
    const history = limit ? allSessions.slice(0, limit) : allSessions;
    // pi-coding-agent SessionInfo: { id, name, modified, messageCount, firstMessage, ... }
    const mapped: SessionInfo[] = history.map((h: any) => ({
      id: h.id,
      title: h.name || h.firstMessage?.slice(0, 40) || 'Untitled Session',
      updatedAt: h.modified instanceof Date ? h.modified.getTime() : h.modified,
      messageCount: h.messageCount || 0,
      status: 'completed' as const,
    }));
    set({ historyItems: mapped });
    return mapped;
  },

  persistCurrentSession: (() => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingStatus: SessionStatus = 'completed';

    return (status: SessionStatus = 'completed') => {
      const { activeSessionId } = get();
      if (!activeSessionId) return;

      pendingStatus = status;

      if (saveTimer !== null) {
        clearTimeout(saveTimer);
      }

      saveTimer = setTimeout(() => {
        saveTimer = null;
        const session = getAgentSession();
        // pi-coding-agent saves automatically on message_end,
        // but we can manually trigger a save if needed or just update local state
        
        set(prev => ({
          currentSession:
            prev.activeSessionId === activeSessionId && prev.currentSession
              ? {
                  ...prev.currentSession,
                  status: pendingStatus,
                  updatedAt: Date.now(),
                  messageCount: session.messages.length,
                }
              : prev.currentSession,
        }));
        
        // Optionally update title if it's the first message
        if (session.messages.length > 0 && (!get().currentSession?.title || get().currentSession?.title === 'New Session')) {
          const firstMsg = session.messages.find(m => m.role === 'user');
          if (firstMsg) {
            const title = extractSessionTitle(typeof firstMsg.content === 'string' ? firstMsg.content : '');
            session.setSessionName(title);
            set(prev => prev.currentSession ? { currentSession: { ...prev.currentSession, title } } : prev);
          }
        }

        void get().refreshHistory();
      }, DEBOUNCE_MS);
    };
  })(),

  restoreSessionById: async (sessionId: string) => {
    const session = getAgentSession();
    try {
      const success = await session.switchSession(sessionId);
      if (!success) return false;

      // Restore both session state and messages atomically
      set({
        activeSessionId: session.sessionId,
        currentSession: {
          id: session.sessionId,
          title: session.sessionName || 'Untitled Session',
          status: 'completed', // Default status for restored sessions
          updatedAt: Date.now(),
          messageCount: session.messages.length,
        },
        messages: agentMessagesToChatMessages(session.messages as any[]),
      });

      return true;
    } catch (err) {
      console.error('[ChatStore] Failed to restore session:', err);
      return false;
    }
  },

  ensureSessionForPrompt: (userInput: string) => {
    const { activeSessionId, currentSession } = get();
    const session = getAgentSession();

    if (activeSessionId) {
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

    // New session logic in pi-coding-agent is session.newSession()
    // but usually it's already in a session.
    set({
      activeSessionId: session.sessionId,
      currentSession: {
        id: session.sessionId,
        title: extractSessionTitle(userInput),
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 1,
      },
    });
    return session.sessionId;
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
  setMessages: messages => set({ messages }),

  addMessage: msg => set(state => ({ messages: [...state.messages, msg] })),

  updateLastMessage: update =>
    set(state => {
      if (state.messages.length === 0) return state;
      const newMessages = [...state.messages];
      const last = newMessages[newMessages.length - 1];
      if (!last) return state;
      newMessages[newMessages.length - 1] = update(last);
      return { messages: newMessages };
    }),

  setUsage: usage => set({ usage }),

  // Combined Actions
  clearAll: () => {
    const session = getAgentSession();
    void session.newSession();
    set({
      activeSessionId: session.sessionId,
      currentSession: null,
      pendingPrompt: null,
      messages: [],
      thinking: false,
      usage: null,
    });
  },
}));
