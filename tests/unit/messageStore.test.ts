/**
 * messageStore 测试
 * 测试 zustand store 的真实行为
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '../../src/apps/cli/ink/store/messageStore.js';
import type { ChatMessage } from '../../src/apps/cli/ink/pages/types.js';

// 创建测试用的消息
function createTestMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    title: 'You',
    createdAt: Date.now(),
    status: 'completed',
    blocks: [{ kind: 'text', text: 'Test message' }],
    ...overrides,
  };
}

describe('messageStore - zustand 真实行为测试', () => {
  beforeEach(() => {
    // 每个测试前清空 store
    useMessageStore.getState().clearMessages();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useMessageStore.getState();

      expect(state.messages).toEqual([]);
      expect(state.thinking).toBe(false);
      expect(state.usage).toBe(null);
    });
  });

  describe('setMessages', () => {
    it('应该正确设置消息数组', () => {
      const messages = [
        createTestMessage({ id: 'msg-1', content: 'First' }),
        createTestMessage({ id: 'msg-2', content: 'Second' }),
      ];

      useMessageStore.getState().setMessages(messages);

      const state = useMessageStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].id).toBe('msg-1');
      expect(state.messages[1].id).toBe('msg-2');
    });

    it('应该替换现有消息', () => {
      useMessageStore.getState().addMessage(createTestMessage({ id: 'old' }));
      useMessageStore.getState().setMessages([createTestMessage({ id: 'new' })]);

      expect(useMessageStore.getState().messages).toHaveLength(1);
      expect(useMessageStore.getState().messages[0].id).toBe('new');
    });

    it('应该处理空数组', () => {
      useMessageStore.getState().setMessages([]);
      expect(useMessageStore.getState().messages).toEqual([]);
    });
  });

  describe('addMessage', () => {
    it('应该添加单条消息', () => {
      const msg = createTestMessage({ id: 'msg-1' });
      useMessageStore.getState().addMessage(msg);

      expect(useMessageStore.getState().messages).toHaveLength(1);
      expect(useMessageStore.getState().messages[0].id).toBe('msg-1');
    });

    it('应该追加消息到末尾', () => {
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-1' }));
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-2' }));
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-3' }));

      const messages = useMessageStore.getState().messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
      expect(messages[2].id).toBe('msg-3');
    });

    it('应该保留之前添加的消息', () => {
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-1' }));
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-2' }));

      expect(useMessageStore.getState().messages).toHaveLength(2);
    });
  });

  describe('updateLastMessage', () => {
    it('应该更新最后一条消息', () => {
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-1' }));
      useMessageStore.getState().addMessage(createTestMessage({ id: 'msg-2' }));

      useMessageStore.getState().updateLastMessage((msg) => ({
        ...msg,
        blocks: [{ kind: 'text', text: 'Updated text' }],
      }));

      const messages = useMessageStore.getState().messages;
      expect(messages[1].blocks).toEqual([{ kind: 'text', text: 'Updated text' }]);
    });

    it('当消息为空时应该不报错', () => {
      // BUG: 当前实现当 messages.length === 0 时会返回 state，而不是不修改
      expect(() => {
        useMessageStore.getState().updateLastMessage((msg) => ({
          ...msg,
          blocks: [{ kind: 'text', text: 'Updated' }],
        }));
      }).not.toThrow();
    });

    it('应该正确处理 update 函数中的不可变更新', () => {
      const originalMsg = createTestMessage({ id: 'msg-1', role: 'user' });
      useMessageStore.getState().addMessage(originalMsg);

      useMessageStore.getState().updateLastMessage((msg) => ({
        ...msg,
        role: 'assistant' as const,
        title: 'Assistant',
      }));

      const updated = useMessageStore.getState().messages[0];
      expect(updated.role).toBe('assistant');
      expect(updated.title).toBe('Assistant');
    });
  });

  describe('clearMessages', () => {
    it('应该清空所有消息', () => {
      useMessageStore.getState().addMessage(createTestMessage());
      useMessageStore.getState().addMessage(createTestMessage());
      useMessageStore.getState().addMessage(createTestMessage());

      useMessageStore.getState().clearMessages();

      expect(useMessageStore.getState().messages).toEqual([]);
    });

    it('应该重置 thinking 为 false', () => {
      useMessageStore.getState().setThinking(true);
      useMessageStore.getState().clearMessages();

      expect(useMessageStore.getState().thinking).toBe(false);
    });

    it('应该重置 usage 为 null', () => {
      useMessageStore.getState().setUsage({ input: 100, output: 200, cost: 0.05 });
      useMessageStore.getState().clearMessages();

      expect(useMessageStore.getState().usage).toBe(null);
    });
  });

  describe('setThinking', () => {
    it('应该设置 thinking 为 true', () => {
      useMessageStore.getState().setThinking(true);
      expect(useMessageStore.getState().thinking).toBe(true);
    });

    it('应该设置 thinking 为 false', () => {
      useMessageStore.getState().setThinking(true);
      useMessageStore.getState().setThinking(false);
      expect(useMessageStore.getState().thinking).toBe(false);
    });

    it('应该保持消息不变', () => {
      useMessageStore.getState().addMessage(createTestMessage());
      useMessageStore.getState().setThinking(true);

      expect(useMessageStore.getState().messages).toHaveLength(1);
    });
  });

  describe('setUsage', () => {
    it('应该设置 usage', () => {
      const usage = { input: 100, output: 200, cost: 0.05 };
      useMessageStore.getState().setUsage(usage);

      expect(useMessageStore.getState().usage).toEqual(usage);
    });

    it('应该设置为 null', () => {
      useMessageStore.getState().setUsage({ input: 100, output: 200, cost: 0.05 });
      useMessageStore.getState().setUsage(null);

      expect(useMessageStore.getState().usage).toBe(null);
    });

    it('应该正确累积 usage', () => {
      useMessageStore.getState().setUsage({ input: 100, output: 200, cost: 0.05 });
      useMessageStore.getState().setUsage({ input: 150, output: 300, cost: 0.08 });

      // 后面的会覆盖前面的，这是 store 的设计
      expect(useMessageStore.getState().usage).toEqual({ input: 150, output: 300, cost: 0.08 });
    });
  });

  // === 边界条件测试 ===
  describe('边界条件', () => {
    it('应该处理添加极长的消息', () => {
      const longText = 'A'.repeat(100000);
      const msg = createTestMessage({ blocks: [{ kind: 'text', text: longText }] });

      useMessageStore.getState().addMessage(msg);

      expect(useMessageStore.getState().messages[0].blocks[0].text).toHaveLength(100000);
    });

    it('应该处理特殊字符和 emoji', () => {
      const msg = createTestMessage({
        blocks: [{ kind: 'text', text: 'Hello 👋🌍 你好 🎉' }],
      });

      useMessageStore.getState().addMessage(msg);

      expect(useMessageStore.getState().messages[0].blocks[0].text).toBe('Hello 👋🌍 你好 🎉');
    });

    it('应该处理消息内容为空', () => {
      const msg = createTestMessage({ blocks: [{ kind: 'text', text: '' }] });

      useMessageStore.getState().addMessage(msg);

      expect(useMessageStore.getState().messages[0].blocks[0].text).toBe('');
    });

    it('应该处理多条空消息', () => {
      useMessageStore.getState().addMessage(createTestMessage({ blocks: [{ kind: 'text', text: '' }] }));
      useMessageStore.getState().addMessage(createTestMessage({ blocks: [{ kind: 'text', text: '' }] }));

      expect(useMessageStore.getState().messages).toHaveLength(2);
    });
  });

  // === 并发状态测试 ===
  describe('并发状态一致性', () => {
    it('多个 addMessage 应该按顺序添加', () => {
      for (let i = 0; i < 10; i++) {
        useMessageStore.getState().addMessage(createTestMessage({ id: `msg-${i}` }));
      }

      expect(useMessageStore.getState().messages).toHaveLength(10);
    });

    it('addMessage 和 setThinking 应该互不影响', () => {
      useMessageStore.getState().setThinking(true);
      useMessageStore.getState().addMessage(createTestMessage());
      useMessageStore.getState().setThinking(false);

      const state = useMessageStore.getState();
      expect(state.thinking).toBe(false);
      expect(state.messages).toHaveLength(1);
    });
  });

  // === BUG 发现测试 ===
  describe('潜在 BUG 测试', () => {
    it('updateLastMessage 在空消息数组时不应该修改 state', () => {
      const stateBefore = useMessageStore.getState();
      useMessageStore.getState().updateLastMessage((msg) => ({
        ...msg,
        blocks: [{ kind: 'text', text: 'Should not apply' }],
      }));

      // BUG: 当前实现当消息为空时会返回整个 state，而不是保持不变
      const stateAfter = useMessageStore.getState();
      expect(stateAfter.messages).toEqual([]);
    });

    it('setUsage 应该是替换而非合并', () => {
      useMessageStore.getState().setUsage({ input: 100, output: 200, cost: 0.05 });
      useMessageStore.getState().setUsage({ input: 150, output: 300, cost: 0.08 });

      // 确认是完全替换而不是合并
      expect(useMessageStore.getState().usage).not.toEqual({ input: 250, output: 500, cost: 0.13 });
      expect(useMessageStore.getState().usage).toEqual({ input: 150, output: 300, cost: 0.08 });
    });
  });
});
