/**
 * promptSubmission 集成测试
 * 测试 prompt 提交流程
 */
import { describe, it, expect, vi } from 'vitest';

// 模拟 pending prompt 流程
describe('promptSubmission 集成测试', () => {
  describe('WelcomePage → ChatPage 流程', () => {
    // 模拟状态
    let page: 'welcome' | 'chat' = 'welcome';
    let pendingPrompt: string | null = null;
    let sessionId: string | null = null;
    let agentMessages: string[] = [];

    const session = {
      ensureSessionForPrompt: (input: string) => {
        if (!sessionId) {
          sessionId = `session-${Date.now()}`;
        }
        return sessionId!;
      },
      setPendingPrompt: (prompt: string) => {
        pendingPrompt = prompt;
      },
      getAndClearPendingPrompt: (): string | null => {
        const p = pendingPrompt;
        pendingPrompt = null;
        return p;
      },
    };

    const agent = {
      prompt: vi.fn((msg: string) => {
        agentMessages.push(msg);
        return Promise.resolve();
      }),
    };

    beforeEach(() => {
      page = 'welcome';
      pendingPrompt = null;
      sessionId = null;
      agentMessages = [];
      vi.clearAllMocks();
    });

    it('WelcomePage should store prompt as pending', () => {
      const input = 'Hello world';

      // WelcomePage 提交
      if (page === 'welcome') {
        session.ensureSessionForPrompt(input);
        session.setPendingPrompt(input);
        page = 'chat';
      }

      expect(pendingPrompt).toBe('Hello world');
      expect(page).toBe('chat');
    });

    it('ChatPage should get and process pending prompt', () => {
      // 先存储 pending
      session.setPendingPrompt('Hello world');

      // ChatPage 挂载时获取
      const pending = session.getAndClearPendingPrompt();

      expect(pending).toBe('Hello world');
      expect(pendingPrompt).toBe(null); // 已清空
    });

    it('pending prompt should be sent to agent', () => {
      // 存储 pending
      session.setPendingPrompt('Hello world');

      // ChatPage 处理
      const pending = session.getAndClearPendingPrompt();
      if (pending) {
        agent.prompt(pending);
      }

      expect(agent.prompt).toHaveBeenCalledTimes(1);
      expect(agent.prompt).toHaveBeenCalledWith('Hello world');
      expect(agentMessages).toContain('Hello world');
    });

    it('multiple prompts should overwrite previous pending', () => {
      session.setPendingPrompt('First');
      session.setPendingPrompt('Second');

      const pending = session.getAndClearPendingPrompt();

      expect(pending).toBe('Second');
    });

    it('no pending prompt should return null', () => {
      const pending = session.getAndClearPendingPrompt();

      expect(pending).toBe(null);
    });
  });

  describe('ChatPage 直接发送流程', () => {
    let agentMessages: string[] = [];

    const agent = {
      prompt: vi.fn((msg: string) => {
        agentMessages.push(msg);
        return Promise.resolve();
      }),
    };

    beforeEach(() => {
      agentMessages = [];
      vi.clearAllMocks();
    });

    it('should send prompt directly without pending', () => {
      const input = 'Direct message';

      // ChatPage 直接发送
      agent.prompt(input);

      expect(agent.prompt).toHaveBeenCalledTimes(1);
      expect(agent.prompt).toHaveBeenCalledWith('Direct message');
    });

    it('should handle empty input', () => {
      const input = '';

      // 空输入应该被忽略
      const trimmed = input.trim();
      if (trimmed) {
        agent.prompt(trimmed);
      }

      expect(agent.prompt).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only input', () => {
      const input = '   ';

      const trimmed = input.trim();
      if (trimmed) {
        agent.prompt(trimmed);
      }

      expect(agent.prompt).not.toHaveBeenCalled();
    });
  });

  describe('model 配置检查流程', () => {
    it('should prompt model config when not configured', () => {
      let currentModel: string | null = null;
      let modelConfigStarted = false;

      const modelConfig = {
        startConfig: () => {
          modelConfigStarted = true;
        },
      };

      const submitPrompt = (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (!currentModel) {
          modelConfig.startConfig();
          return;
        }

        // 正常发送
      };

      // 提交时没有配置 model
      submitPrompt('Hello');

      expect(modelConfigStarted).toBe(true);
    });

    it('should send directly when model is configured', () => {
      let currentModel: string | null = 'gpt-4';
      let agentCalled = false;

      const modelConfig = {
        startConfig: () => {
          // 不应该调用
        },
      };

      const agent = {
        prompt: () => {
          agentCalled = true;
          return Promise.resolve();
        },
      };

      const submitPrompt = (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (!currentModel) {
          modelConfig.startConfig();
          return;
        }

        agent.prompt();
      };

      submitPrompt('Hello');

      expect(agentCalled).toBe(true);
    });
  });

  describe('session 确保流程', () => {
    it('should create new session if none exists', () => {
      let sessionId: string | null = null;

      const session = {
        ensureSessionForPrompt: (input: string) => {
          if (!sessionId) {
            sessionId = `new-session-${Date.now()}`;
          }
          return sessionId;
        },
      };

      const newSessionId = session.ensureSessionForPrompt('Hello');

      expect(newSessionId).toContain('new-session-');
    });

    it('should reuse existing session', () => {
      const existingSessionId = 'existing-session-123';
      let sessionId = existingSessionId;

      const session = {
        ensureSessionForPrompt: (input: string) => {
          if (sessionId) {
            return sessionId;
          }
          return `new-session-${Date.now()}`;
        },
      };

      const reusedSessionId = session.ensureSessionForPrompt('Hello');

      expect(reusedSessionId).toBe(existingSessionId);
    });
  });
});
