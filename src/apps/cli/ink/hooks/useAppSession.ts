/**
 * useAppSession - Session management using sessionManager directly
 * Replaces useSession with direct sessionManager calls for persistence.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAgent } from '../../../../agent/index.js';
import { sessionManager, SessionInfo, SessionRecord, SessionStatus } from '../../../../agent/sessions.js';
import { ChatSessionInfo } from '../pages/types.js';

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

export function useAppSession() {
  const agent = getAgent();
  const [historyItems, setHistoryItems] = useState<SessionInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSessionInfo | null>(null);

  const activeSessionIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  // Pending prompt to be sent after ChatPage mounts
  const pendingPromptRef = useRef<string | null>(null);

  const refreshHistory = useCallback(async (limit?: number) => {
    const history = await sessionManager.getHistory(limit ?? 50);
    setHistoryItems(history);
    return history;
  }, []);

  const persistCurrentSession = useCallback((status: SessionStatus = 'completed', messages?: any[]) => {
    const stableSessionId = activeSessionIdRef.current;
    if (!stableSessionId) return;

    if (saveTimeoutRef.current) return;
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
    }, 500);

    if (isSavingRef.current) return;
    isSavingRef.current = true;

    agent.sessionId = stableSessionId;

    const title = currentSession?.id === stableSessionId ? currentSession.title : null;
    const messagesToUse = messages || [];

    setCurrentSession(prev => {
      if (!prev || prev.id !== stableSessionId) return prev;
      return {
        ...prev,
        status,
        updatedAt: Date.now(),
        messageCount: messagesToUse.length,
        title: prev.title || extractSessionTitle(messagesToUse[0]?.content || ''),
      };
    });

    void sessionManager
      .saveSession(stableSessionId, agent.state.messages, {
        status,
        model: agent.state.model?.id,
        provider: agent.state.model?.provider,
        ...(title ? { title } : {}),
      })
      .then(() => {
        isSavingRef.current = false;
        void refreshHistory();
      })
      .catch(() => {
        isSavingRef.current = false;
      });
  }, [agent, refreshHistory, currentSession]);

  const restoreSessionById = useCallback(async (sessionId: string): Promise<boolean> => {
    const record = await sessionManager.loadSession(sessionId);
    if (!record) return false;

    activeSessionIdRef.current = record.id;
    agent.sessionId = record.id;
    agent.replaceMessages(record.messages);
    setCurrentSession(toSessionView(record));
    return true;
  }, [agent]);

  const clearSession = useCallback(() => {
    activeSessionIdRef.current = null;
    setCurrentSession(null);
    pendingPromptRef.current = null;
  }, []);

  const ensureSessionForPrompt = useCallback((userInput: string): string => {
    const stableSessionId = activeSessionIdRef.current;
    if (stableSessionId) {
      agent.sessionId = stableSessionId;
      if (!currentSession) {
        setCurrentSession({
          id: stableSessionId,
          title: extractSessionTitle(userInput),
          status: 'active',
          updatedAt: Date.now(),
          messageCount: 1,
        });
      }
      return stableSessionId;
    }

    const newSessionId = createSessionId();
    activeSessionIdRef.current = newSessionId;
    agent.sessionId = newSessionId;
    setCurrentSession({
      id: newSessionId,
      title: extractSessionTitle(userInput),
      status: 'active',
      updatedAt: Date.now(),
      messageCount: 1,
    });
    return newSessionId;
  }, [agent, currentSession]);

  const setPendingPrompt = useCallback((prompt: string) => {
    pendingPromptRef.current = prompt;
  }, []);

  const getAndClearPendingPrompt = useCallback((): string | null => {
    const pending = pendingPromptRef.current;
    pendingPromptRef.current = null;
    return pending;
  }, []);

  // Initial history load
  useEffect(() => {
    void refreshHistory(1);
  }, [refreshHistory]);

  return {
    historyItems,
    currentSession,
    setCurrentSession,
    activeSessionIdRef,
    pendingPromptRef,
    refreshHistory,
    persistCurrentSession,
    restoreSessionById,
    clearSession,
    ensureSessionForPrompt,
    setPendingPrompt,
    getAndClearPendingPrompt,
  };
}
