/**
 * sessionStore 集成测试
 * 测试 sessionStore 与其他模块的真实交互
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock 外部模块 - 使用 vi.hoisted 避免 hoisting 问题
const { mockAgent, mockSessionManager } = vi.hoisted(() => {
  const mockAgent = {
    sessionId: null as string | null,
    state: {
      messages: [] as any[],
      model: null as any,
    },
    replaceMessages: vi.fn(),
  };

  const mockSessionManager = {
    getHistory: vi.fn<() => Promise<any[]>>(),
    loadSession: vi.fn<(id: string) => Promise<any>>(),
    saveSession: vi.fn<() => Promise<void>>(),
  };

  return { mockAgent, mockSessionManager };
});

vi.mock('../../src/agent/index.js', () => ({
  getAgent: vi.fn(() => mockAgent),
}));

vi.mock('../../src/agent/sessions.js', () => ({
  sessionManager: mockSessionManager,
  SessionInfo: {},
  SessionRecord: {},
  SessionStatus: 'completed',
}));

// 导入真实模块
import { useSessionStore } from '../../src/apps/cli/ink/store/sessionStore.js';
import { useMessageStore } from '../../src/apps/cli/ink/store/messageStore.js';

describe('sessionStore 集成测试 - 真实模块交互', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.sessionId = null;
    mockAgent.state.messages = [];
    mockAgent.state.model = null;
    mockAgent.replaceMessages.mockClear();
    mockSessionManager.getHistory.mockResolvedValue([]);
    mockSessionManager.loadSession.mockResolvedValue(null);
    mockSessionManager.saveSession.mockResolvedValue(undefined);

    // 清空所有 store
    useSessionStore.getState().clearSession();
    useMessageStore.getState().clearMessages();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureSessionForPrompt - 与 getAgent 的交互', () => {
    it('应该设置 agent.sessionId 为新的 session id', () => {
      const sessionId = useSessionStore.getState().ensureSessionForPrompt('Hello world');

      expect(sessionId).toBeTruthy();
      expect(sessionId.startsWith('sess-') || sessionId.includes('-')).toBe(true);
      expect(mockAgent.sessionId).toBe(sessionId);
    });

    it('应该使用已存在的 session id 而不是创建新的', () => {
      const firstSessionId = useSessionStore.getState().ensureSessionForPrompt('First message');
      const secondSessionId = useSessionStore.getState().ensureSessionForPrompt('Second message');

      expect(firstSessionId).toBe(secondSessionId);
    });

    it('应该设置正确的 session title', () => {
      useSessionStore.getState().ensureSessionForPrompt('What is AI?');

      const state = useSessionStore.getState();
      expect(state.currentSession?.title).toBe('What is AI?');
    });

    it('应该截断过长的 session title', () => {
      const longTitle = 'A'.repeat(100);
      useSessionStore.getState().ensureSessionForPrompt(longTitle);

      const state = useSessionStore.getState();
      expect(state.currentSession?.title?.length).toBe(43); // 40 + '...'
    });

    it('应该设置 session status 为 active', () => {
      useSessionStore.getState().ensureSessionForPrompt('Hello');

      const state = useSessionStore.getState();
      expect(state.currentSession?.status).toBe('active');
    });

    it('应该设置 messageCount 为 1', () => {
      useSessionStore.getState().ensureSessionForPrompt('Hello');

      const state = useSessionStore.getState();
      expect(state.currentSession?.messageCount).toBe(1);
    });
  });

  describe('clearSession - 重置所有状态', () => {
    it('应该清空 session 状态', () => {
      useSessionStore.getState().ensureSessionForPrompt('Hello');
      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.activeSessionId).toBeNull();
      expect(state.currentSession).toBeNull();
    });

    it('应该调用 agent.replaceMessages([])', () => {
      useSessionStore.getState().ensureSessionForPrompt('Hello');
      useSessionStore.getState().clearSession();

      expect(mockAgent.replaceMessages).toHaveBeenCalledWith([]);
    });

    it('应该清空 pendingPrompt', () => {
      useSessionStore.getState().setPendingPrompt('Hello');
      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.pendingPrompt).toBeNull();
    });
  });

  describe('setPendingPrompt / getAndClearPendingPrompt', () => {
    it('应该设置和获取 pending prompt', () => {
      useSessionStore.getState().setPendingPrompt('Hello world');

      const state = useSessionStore.getState();
      expect(state.pendingPrompt).toBe('Hello world');
    });

    it('getAndClearPendingPrompt 应该返回并清空', () => {
      useSessionStore.getState().setPendingPrompt('Hello world');

      const prompt = useSessionStore.getState().getAndClearPendingPrompt();

      expect(prompt).toBe('Hello world');
      expect(useSessionStore.getState().pendingPrompt).toBeNull();
    });

    it('getAndClearPendingPrompt 再次调用应该返回 null', () => {
      useSessionStore.getState().setPendingPrompt('Hello');

      useSessionStore.getState().getAndClearPendingPrompt();
      const second = useSessionStore.getState().getAndClearPendingPrompt();

      expect(second).toBeNull();
    });
  });

  describe('refreshHistory - 与 sessionManager 的交互', () => {
    it('应该调用 sessionManager.getHistory', async () => {
      mockSessionManager.getHistory.mockResolvedValue([
        { id: 'sess-1', title: 'Session 1' },
        { id: 'sess-2', title: 'Session 2' },
      ]);

      await useSessionStore.getState().refreshHistory();

      expect(mockSessionManager.getHistory).toHaveBeenCalledWith(50); // 默认 limit
    });

    it('应该接受自定义 limit', async () => {
      mockSessionManager.getHistory.mockResolvedValue([]);

      await useSessionStore.getState().refreshHistory(10);

      expect(mockSessionManager.getHistory).toHaveBeenCalledWith(10);
    });

    it('应该更新 historyItems 状态', async () => {
      const historyItems = [
        { id: 'sess-1', title: 'Session 1' },
        { id: 'sess-2', title: 'Session 2' },
      ];
      mockSessionManager.getHistory.mockResolvedValue(historyItems);

      await useSessionStore.getState().refreshHistory();

      const state = useSessionStore.getState();
      expect(state.historyItems).toEqual(historyItems);
    });
  });

  describe('restoreSessionById - 完整恢复流程', () => {
    it('应该调用 sessionManager.loadSession', async () => {
      mockSessionManager.loadSession.mockResolvedValue({
        id: 'sess-123',
        title: 'Test Session',
        messages: [{ role: 'user', content: 'Hello' }],
        meta: { status: 'completed', updatedAt: 1234567890 },
      });

      await useSessionStore.getState().restoreSessionById('sess-123');

      expect(mockSessionManager.loadSession).toHaveBeenCalledWith('sess-123');
    });

    it('应该设置 activeSessionId', async () => {
      mockSessionManager.loadSession.mockResolvedValue({
        id: 'sess-123',
        title: 'Test Session',
        messages: [],
        meta: { status: 'completed', updatedAt: 1234567890 },
      });

      await useSessionStore.getState().restoreSessionById('sess-123');

      expect(useSessionStore.getState().activeSessionId).toBe('sess-123');
    });

    it('应该调用 agent.replaceMessages', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      mockSessionManager.loadSession.mockResolvedValue({
        id: 'sess-123',
        title: 'Test Session',
        messages,
        meta: { status: 'completed', updatedAt: 1234567890 },
      });

      await useSessionStore.getState().restoreSessionById('sess-123');

      expect(mockAgent.replaceMessages).toHaveBeenCalledWith(messages);
    });

    it('应该更新 messageStore.setMessages', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      mockSessionManager.loadSession.mockResolvedValue({
        id: 'sess-123',
        title: 'Test Session',
        messages,
        meta: { status: 'completed', updatedAt: 1234567890 },
      });

      await useSessionStore.getState().restoreSessionById('sess-123');

      const msgState = useMessageStore.getState();
      expect(msgState.messages.length).toBeGreaterThan(0);
    });

    it('应该返回 false 当 session 不存在', async () => {
      mockSessionManager.loadSession.mockResolvedValue(null);

      const result = await useSessionStore.getState().restoreSessionById('non-existent');

      expect(result).toBe(false);
    });

    it('应该设置正确的 currentSession', async () => {
      mockSessionManager.loadSession.mockResolvedValue({
        id: 'sess-123',
        title: 'My Session',
        messages: [],
        meta: { status: 'completed', updatedAt: 1234567890 },
      });

      await useSessionStore.getState().restoreSessionById('sess-123');

      const state = useSessionStore.getState();
      expect(state.currentSession?.id).toBe('sess-123');
      expect(state.currentSession?.title).toBe('My Session');
    });
  });

  describe('persistCurrentSession - 保存会话', () => {
    it('当没有 activeSessionId 时不应该保存', () => {
      useSessionStore.getState().persistCurrentSession();

      expect(mockSessionManager.saveSession).not.toHaveBeenCalled();
    });

    it('应该调用 sessionManager.saveSession', () => {
      useSessionStore.getState().ensureSessionForPrompt('Hello');
      useSessionStore.getState().persistCurrentSession();

      expect(mockSessionManager.saveSession).toHaveBeenCalled();
    });
  });

  describe('多 session 流程', () => {
    it('创建新 session 应该重置 agent.sessionId', () => {
      const session1 = useSessionStore.getState().ensureSessionForPrompt('First');
      expect(mockAgent.sessionId).toBe(session1);

      useSessionStore.getState().clearSession();
      const session2 = useSessionStore.getState().ensureSessionForPrompt('Second');

      expect(session2).not.toBe(session1);
      expect(mockAgent.sessionId).toBe(session2);
    });

    it('restoreSession 应该更新 agent.sessionId', async () => {
      useSessionStore.getState().ensureSessionForPrompt('Before');
      const oldSessionId = mockAgent.sessionId;

      mockSessionManager.loadSession.mockResolvedValue({
        id: 'sess-restored',
        title: 'Restored',
        messages: [],
        meta: { status: 'completed', updatedAt: 1234567890 },
      });

      await useSessionStore.getState().restoreSessionById('sess-restored');

      expect(mockAgent.sessionId).toBe('sess-restored');
      expect(mockAgent.sessionId).not.toBe(oldSessionId);
    });
  });
});
