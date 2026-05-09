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
import {
  listSessions,
  newSession as coreNewSession,
  activateSession,
  getSessionId,
  getSessionName,
  setSessionName,
  getSessionMessages,
  getSessionFile,
  logger,
} from '@codeagent/core';
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
  path: string;
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

/**
 * Extract project CWD from a session file path.
 * Session path format: ~/.pi/agent/sessions/--{encoded_cwd}--/{timestamp}_{id}.jsonl
 */
function projectCwdFromSessionPath(sessionPath: string): string {
  const match = sessionPath.match(/[\\/]sessions[\\/](--[^\\/]+--)[\\/]/);
  if (!match || !match[1]) return '';
  const encoded = match[1]!;
  const inner = encoded.slice(2, -2);
  const parts = inner.split('--');
  if (parts[0] && parts[0].length === 1 && /[A-Za-z]/.test(parts[0])) {
    return parts[0] + ':\\' + parts.slice(1).join('\\');
  }
  return '/' + parts.join('/');
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
  restoreSessionByPath: (sessionPath: string) => Promise<boolean>;
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
  clearAll: () => Promise<void>;
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
    const allSessions = await listSessions();
    const history = limit ? allSessions.slice(0, limit) : allSessions;
    // pi-coding-agent SessionInfo: { id, path, name, modified, messageCount, firstMessage, ... }
    const mapped: SessionInfo[] = history.map((h: any) => ({
      id: h.id,
      path: h.path,
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
        const messages = getSessionMessages();
        // pi-coding-agent saves automatically on message_end,
        // but we can manually trigger a save if needed or just update local state

        set(prev => ({
          currentSession:
            prev.activeSessionId === activeSessionId && prev.currentSession
              ? {
                  ...prev.currentSession,
                  status: pendingStatus,
                  updatedAt: Date.now(),
                  messageCount: messages.length,
                }
              : prev.currentSession,
        }));

        // Optionally update title if it's the first message
        if (messages.length > 0 && (!get().currentSession?.title || get().currentSession?.title === 'New Session')) {
          const firstMsg = messages.find((m: any) => m.role === 'user');
          if (firstMsg) {
            const title = extractSessionTitle(typeof firstMsg.content === 'string' ? firstMsg.content : '');
            setSessionName(title);
            set(prev => prev.currentSession ? { currentSession: { ...prev.currentSession, title } } : prev);
          }
        }

        void get().refreshHistory();
      }, DEBOUNCE_MS);
    };
  })(),

  restoreSessionByPath: async (sessionPath: string) => {
    try {
      // activateSession expects (sessionPath, projectCwd)
      // We extract projectCwd from the sessionPath
      const projectCwd = projectCwdFromSessionPath(sessionPath);
      await activateSession(sessionPath, projectCwd);

      const sessionName = getSessionName() || 'Untitled Session';

      set({
        activeSessionId: getSessionId(),
        currentSession: {
          id: getSessionId(),
          path: getSessionFile() || sessionPath,
          title: sessionName || 'Untitled Session',
          status: 'completed',
          updatedAt: Date.now(),
          messageCount: getSessionMessages().length,
        },
        messages: agentMessagesToChatMessages(getSessionMessages() as any[]),
      });

      return true;
    } catch (err) {
      console.error('[ChatStore] Failed to restore session:', err);
      // Reset state on failure to avoid inconsistent state
      set({
        activeSessionId: null,
        currentSession: null,
        messages: [],
      });
      return false;
    }
  },

  restoreSessionById: async (sessionId: string) => {
    try {
      const allSessions = await listSessions();
      const session = allSessions.find((s: any) => s.id === sessionId);
      if (!session) {
        console.error('[ChatStore] Session not found:', sessionId);
        return false;
      }
      return await get().restoreSessionByPath(session.path);
    } catch (err) {
      console.error('[ChatStore] Failed to restore session by id:', sessionId, err);
      return false;
    }
  },

  ensureSessionForPrompt: (userInput: string) => {
    const { activeSessionId, currentSession } = get();

    if (activeSessionId) {
      if (!currentSession) {
        set({
          currentSession: {
            id: activeSessionId,
            path: getSessionFile() || '',
            title: extractSessionTitle(userInput),
            status: 'active',
            updatedAt: Date.now(),
            messageCount: 1,
          },
        });
      }
      return activeSessionId;
    }

    // New session — no need to call newSession() explicitly here,
    // the session already exists after ensureAgentInitialized().
    const sessionId = getSessionId();
    const title = extractSessionTitle(userInput);
    setSessionName(title);
    set({
      activeSessionId: sessionId,
      currentSession: {
        id: sessionId,
        path: getSessionFile() || '',
        title,
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 1,
      },
    });
    return sessionId;
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

  addMessage: msg => {
    // Capture full stack trace for every call
    const err = new Error();
    const frames = (err.stack || '').split('\n').slice(1);
    const callerInfo = frames.slice(0, 5).map(f => f.trim()).join(' || ');
    // Duplicate guard - check if message with same ID already exists
    const existing = useChatStore.getState().messages.find(m => m.id === msg.id);
    if (existing) {
      logger.warn(`DUPLICATE id=${msg.id} role=${msg.role} text=${msg.blocks[0]?.text?.slice(0, 15)} stack=${callerInfo.slice(0, 150)}`);
      return;
    }
    logger.debug(`ADD id=${msg.id} role=${msg.role} text=${msg.blocks[0]?.text?.slice(0, 15)} stack=${callerInfo.slice(0, 100)}`);
    set(state => ({ messages: [...state.messages, msg] }));
  },

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
  clearAll: async () => {
    await coreNewSession();
    set({
      activeSessionId: getSessionId(),
      currentSession: null,
      pendingPrompt: null,
      messages: [],
      thinking: false,
      usage: null,
    });
  },
}));
