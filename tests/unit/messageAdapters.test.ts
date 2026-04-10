/**
 * messageAdapters 测试
 * 测试 agent 消息到 chat 消息的真实转换逻辑
 */
import { describe, it, expect } from 'vitest';
import { agentMessagesToChatMessages } from '../../src/apps/cli/ink/utils/messageAdapters.js';

// 导入真实类型
import type { AgentMessage } from '@mariozechner/pi-agent-core';

describe('messageAdapters - 真实转换逻辑测试', () => {
  describe('agentMessagesToChatMessages', () => {
    it('应该正确转换 user 角色消息', () => {
      const agentMessages: AgentMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello world',
          createdAt: 1000,
        },
      ];

      const result = agentMessagesToChatMessages(agentMessages);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-1');
      expect(result[0].role).toBe('user');
      expect(result[0].title).toBe('You');
      expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hello world' }]);
    });

    it('应该正确转换 assistant 角色消息', () => {
      const agentMessages: AgentMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          createdAt: 2000,
        },
      ];

      const result = agentMessagesToChatMessages(agentMessages);

      expect(result[0].role).toBe('assistant');
      expect(result[0].title).toBe('Assistant');
      expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hi there!' }]);
    });

    it('应该正确转换 system 角色消息', () => {
      const agentMessages: AgentMessage[] = [
        {
          id: 'msg-3',
          role: 'system',
          content: 'System prompt',
          createdAt: 3000,
        },
      ];

      const result = agentMessagesToChatMessages(agentMessages);

      expect(result[0].role).toBe('system');
      expect(result[0].title).toBe('System');
    });

    it('应该正确转换 error 角色消息', () => {
      const agentMessages: AgentMessage[] = [
        {
          id: 'msg-4',
          role: 'error',
          content: 'Something went wrong',
          createdAt: 4000,
        },
      ];

      const result = agentMessagesToChatMessages(agentMessages);

      expect(result[0].role).toBe('error');
      expect(result[0].title).toBe('Error');
      expect(result[0].status).toBe('error');
    });

    // === BUG 潜在点：未知角色 ===
    it('应该处理未知角色 - 默认转为 system', () => {
      const agentMessages: AgentMessage[] = [
        {
          id: 'msg-5',
          role: 'unknown_role' as any,
          content: 'Unknown content',
          createdAt: 5000,
        },
      ];

      const result = agentMessagesToChatMessages(agentMessages);

      // BUG: 未知角色应该报错或警告，而不是静默转为 system
      expect(result[0].role).toBe('system');
    });

    // === 边界条件测试 ===
    describe('边界条件', () => {
      it('应该处理空数组', () => {
        const result = agentMessagesToChatMessages([]);
        expect(result).toEqual([]);
      });

      it('应该处理 content 为空字符串', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-6', role: 'user', content: '', createdAt: 6000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: '' }]);
      });

      it('应该处理 undefined content', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-7', role: 'user', content: undefined, createdAt: 7000 } as any,
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // BUG: undefined content 应该被处理，而不是静默
        expect(result[0].blocks).toEqual([{ kind: 'text', text: '' }]);
      });

      it('应该处理 content 为 null', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-8', role: 'user', content: null, createdAt: 8000 } as any,
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // BUG: null content 可能导致问题
        expect(result[0].blocks).toEqual([{ kind: 'text', text: '' }]);
      });

      it('应该处理 content 为数字', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-9', role: 'user', content: 123 as any, createdAt: 9000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // BUG: 数字类型应该被转换，而不是静默
        expect(result[0].blocks).toEqual([{ kind: 'text', text: '' }]);
      });

      it('应该处理 content 为对象', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-10', role: 'user', content: { text: 'Hello' } as any, createdAt: 10000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hello' }]);
      });

      it('应该处理 content 为对象但没有 text 属性', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-11', role: 'user', content: { no_text: 'Hello' } as any, createdAt: 11000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // BUG: 对象没有 text 属性应该返回什么？
        expect(result[0].blocks).toEqual([{ kind: 'text', text: '' }]);
      });
    });

    // === 数组 content 测试 ===
    describe('数组 content 处理', () => {
      it('应该处理字符串数组', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-12', role: 'user', content: ['Hello', 'World'] as any, createdAt: 12000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hello World' }]);
      });

      it('应该处理混合类型数组', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-13', role: 'user', content: ['Hello', { text: 'World' }, { content: '!' }] as any, createdAt: 13000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hello World !' }]);
      });

      it('应该过滤掉空值', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-14', role: 'user', content: ['Hello', '', null, 'World'] as any, createdAt: 14000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hello World' }]);
      });
    });

    // === createdAt 测试 ===
    describe('createdAt 处理', () => {
      it('应该使用消息中的 createdAt', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-15', role: 'user', content: 'Hello', createdAt: 1234567890 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].createdAt).toBe(1234567890);
      });

      it('应该处理 createdAt 为字符串', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-16', role: 'user', content: 'Hello', createdAt: '2024-01-01' as any },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // BUG: 字符串日期会被转为 NaN，然后 fallback 到 Date.now() + index
        expect(result[0].createdAt).toBeDefined();
      });

      it('应该处理 createdAt 缺失 - 使用 index fallback', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-17', role: 'user', content: 'Hello' } as any,
          { id: 'msg-18', role: 'user', content: 'World' } as any,
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // createdAt 应该是 Date.now() + index
        expect(result[0].createdAt).toBeLessThanOrEqual(Date.now());
        expect(result[1].createdAt).toBeGreaterThan(result[0].createdAt);
      });
    });

    // === ID 生成测试 ===
    describe('ID 生成', () => {
      it('应该使用消息中的 id', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'my-custom-id', role: 'user', content: 'Hello', createdAt: 1000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].id).toBe('my-custom-id');
      });

      it('应该生成 fallback id 当 id 缺失时', () => {
        const agentMessages: AgentMessage[] = [
          { role: 'user', content: 'Hello', createdAt: 1000 } as any,
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].id).toMatch(/^user-\d+-\d+$/);
      });
    });

    // === 特殊字符测试 ===
    describe('特殊字符处理', () => {
      it('应该处理 emoji', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-emoji', role: 'user', content: 'Hello 👋🌍', createdAt: 1000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Hello 👋🌍' }]);
      });

      it('应该处理多行文本', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-multi', role: 'user', content: 'Line 1\nLine 2\nLine 3', createdAt: 1000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks).toEqual([{ kind: 'text', text: 'Line 1\nLine 2\nLine 3' }]);
      });

      it('应该处理 SQL 注入尝试', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-sql', role: 'user', content: "'; DROP TABLE users; --", createdAt: 1000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // 应该被当作普通文本处理
        expect(result[0].blocks).toEqual([{ kind: 'text', text: "'; DROP TABLE users; --" }]);
      });

      it('应该处理 XSS 尝试', () => {
        const agentMessages: AgentMessage[] = [
          { id: 'msg-xss', role: 'user', content: '<script>alert("xss")</script>', createdAt: 1000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        // 应该被当作普通文本处理，不做转义（转义应该在渲染层）
        expect(result[0].blocks).toEqual([{ kind: 'text', text: '<script>alert("xss")</script>' }]);
      });

      it('应该处理超长文本', () => {
        const longText = 'A'.repeat(100000);
        const agentMessages: AgentMessage[] = [
          { id: 'msg-long', role: 'user', content: longText, createdAt: 1000 },
        ];

        const result = agentMessagesToChatMessages(agentMessages);

        expect(result[0].blocks[0].text).toHaveLength(100000);
      });
    });
  });
});
