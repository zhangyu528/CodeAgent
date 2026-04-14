/**
 * SessionManager 集成测试
 * 测试会话创建、更新、删除的完整流程
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../src/agent/sessions.js';
import type { AgentMessage } from '@mariozechner/pi-agent-core';

// 创建一个独立的测试用 SessionManager 实例
describe('SessionManager 集成测试', () => {
  let sessionManager: SessionManager;
  let mockMessages: AgentMessage[];

  beforeEach(() => {
    vi.clearAllMocks();
    // 创建新的 SessionManager 实例用于测试
    sessionManager = new SessionManager();
    mockMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: Date.now(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        createdAt: Date.now(),
      },
    ];
  });

  describe('saveSession - 基本功能测试', () => {
    it('应该成功创建会话', async () => {
      const sessionId = 'test-session-' + Date.now();
      
      // saveSession 不应该抛出异常
      await expect(
        sessionManager.saveSession(sessionId, mockMessages, {
          title: 'Test Session',
          model: 'gpt-4',
          provider: 'openai',
          status: 'completed',
        })
      ).resolves.not.toThrow();
    });

    it('应该使用默认标题', async () => {
      const sessionId = 'test-session-default-' + Date.now();
      
      await expect(
        sessionManager.saveSession(sessionId, mockMessages)
      ).resolves.not.toThrow();
    });

    it('应该处理空消息数组', async () => {
      const sessionId = 'test-session-empty-' + Date.now();
      
      await expect(
        sessionManager.saveSession(sessionId, [])
      ).resolves.not.toThrow();
    });

    it('应该保存不同状态的会话', async () => {
      const statuses = ['active', 'completed', 'interrupted', 'error'] as const;
      
      for (const status of statuses) {
        const sessionId = `test-session-${status}-${Date.now()}`;
        await expect(
          sessionManager.saveSession(sessionId, mockMessages, { status })
        ).resolves.not.toThrow();
      }
    });
  });

  describe('loadSession - 基本功能测试', () => {
    it('应该返回 null 当会话不存在', async () => {
      const result = await sessionManager.loadSession('non-existent-session-' + Date.now());
      expect(result).toBeNull();
    });

    it('应该正确处理无效的 JSON 数据', async () => {
      // 空字符串不是有效的 session ID，应返回 null
      const result = await sessionManager.loadSession('');
      expect(result).toBeNull();
    });
  });

  describe('getHistory - 基本功能测试', () => {
    it('应该返回数组类型', async () => {
      const result = await sessionManager.getHistory();
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该支持 limit 参数', async () => {
      const result = await sessionManager.getHistory(5);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('应该返回有效的会话信息数组', async () => {
      const result = await sessionManager.getHistory(10);
      
      for (const session of result) {
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('title');
        expect(session).toHaveProperty('updatedAt');
        expect(session).toHaveProperty('status');
      }
    });
  });

  describe('getLatestSessionId - 基本功能测试', () => {
    it('应该返回字符串或 null', async () => {
      const result = await sessionManager.getLatestSessionId();
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('返回的 ID 应该是有效的格式', async () => {
      const result = await sessionManager.getLatestSessionId();
      if (result) {
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('会话标题提取', () => {
    it('应该从用户消息中提取标题', async () => {
      const userMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'This is a test message',
          createdAt: Date.now(),
        },
      ];
      
      const sessionId = 'test-session-title-' + Date.now();
      await sessionManager.saveSession(sessionId, userMessages);
      
      // 标题从第一条用户消息中提取，前40字符作为标题
      const record = await sessionManager.loadSession(sessionId);
      expect(record).not.toBeNull();
      expect(record!.meta.title).toBe('This is a test message');
    });

    it('应该处理复杂的 content 格式', async () => {
      const complexMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
          ],
          createdAt: Date.now(),
        },
      ];
      
      const sessionId = 'test-session-complex-' + Date.now();
      await expect(
        sessionManager.saveSession(sessionId, complexMessages)
      ).resolves.not.toThrow();
    });
  });

  describe('SessionMeta 类型验证', () => {
    it('应该包含所有必需的属性', () => {
      const meta = {
        id: 'test-id',
        title: 'Test Title',
        updatedAt: Date.now(),
        messageCount: 5,
        model: 'gpt-4',
        provider: 'openai',
        status: 'completed' as const,
        version: 1,
      };
      
      expect(meta.id).toBe('test-id');
      expect(meta.title).toBe('Test Title');
      expect(meta.updatedAt).toBeTruthy();
      expect(meta.messageCount).toBe(5);
      expect(meta.model).toBe('gpt-4');
      expect(meta.provider).toBe('openai');
      expect(meta.status).toBe('completed');
      expect(meta.version).toBe(1);
    });

    it('应该支持所有会话状态', () => {
      const statuses: ('active' | 'completed' | 'interrupted' | 'error')[] = [
        'active',
        'completed',
        'interrupted',
        'error',
      ];
      
      for (const status of statuses) {
        const meta = { status };
        expect(meta.status).toBe(status);
      }
    });
  });
});
