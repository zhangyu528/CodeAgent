/**
 * SessionStore - Shared session state across all components
 * Replaces useAppSession's local state with global state
 */
import { create } from 'zustand';
import { getAgent } from '../../../../agent/index.js';
import { sessionManager, SessionInfo, SessionRecord, SessionStatus } from '../../../../agent/sessions.js';
import { ChatSessionInfo } from '../pages/types.js';
import { useMessageStore } from './messageStore.js';
import { agentMessagesToChatMessages } from '../utils/messageAdapters.js';

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

function toSessionView(record: SessionRecord): ChatSessionInfo {
  return {
    id: record.id,
    title: record.title || 'Untitled Session',
    status: record.meta.status,
    updatedAt: record.meta.updatedAt,
    messageCount: record.messages?.length || 0,
  };
}

interface SessionStore {
  // State
  historyItems: SessionInfo[];
  currentSession: ChatSessionInfo | null;
  activeSessionId: string | null;
  pendingPrompt: string | null;

  // Actions
  refreshHistory: (limit?: number) => Promise<SessionInfo[]>;
  persistCurrentSession: (status?: SessionStatus, messages?: any[]) => void;
  restoreSessionById: (sessionId: string) => Promise<boolean>;
  clearSession: () => void;
  ensureSessionForPrompt: (userInput: string) => string;
  setPendingPrompt: (prompt: string | null) => void;
  getAndClearPendingPrompt: () => string | null;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  historyItems: [],
  currentSession: null,
  activeSessionId: null,
  pendingPrompt: null,

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
      currentSession: prev.id === activeSessionId && prev.currentSession ? {
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
    useMessageStore.getState().setMessages(agentMessagesToChatMessages(record.messages));
    set({
      activeSessionId: record.id,
      currentSession: toSessionView(record),
    });
    return true;
  },

  clearSession: () => {
    const agent = getAgent();
    agent.replaceMessages([]);
    set({
      activeSessionId: null,
      currentSession: null,
      pendingPrompt: null,
    });
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

  setPendingPrompt: (prompt: string | null) => {
    set({ pendingPrompt: prompt });
  },

  getAndClearPendingPrompt: () => {
    const { pendingPrompt } = get();
    set({ pendingPrompt: null });
    return pendingPrompt;
  },
}));
