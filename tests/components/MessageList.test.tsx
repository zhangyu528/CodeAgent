/**
 * MessageList 组件测试
 * 测试消息列表的渲染、分组和滚动功能
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatMessage } from '../../src/apps/cli/ink/pages/types.js';

// Mock external dependencies
vi.mock('ink-scroll-view', () => ({
  ScrollView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@byteland/ink-scroll-bar', () => ({
  ScrollBar: () => null,
}));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({
      stdout: {
        on: vi.fn(),
        off: vi.fn(),
      },
    }),
  };
});

// Import after mocking
import { MessageList } from '../../src/apps/cli/ink/components/chat/MessageList.js';

// Helper function to create test messages
function createMessage(
  id: string,
  role: 'user' | 'assistant' | 'error',
  text: string,
  createdAt: number,
  status: 'streaming' | 'completed' | 'error' = 'completed'
): ChatMessage {
  return {
    id,
    role,
    title: role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'Error',
    createdAt,
    status,
    blocks: [{ kind: 'text' as const, text }],
  };
}

describe('MessageList', () => {
  describe('空消息状态', () => {
    it('should render empty state message', () => {
      const { lastFrame } = render(
        <MessageList
          messages={[]}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('暂无消息');
    });

    it('should render with empty messages array', () => {
      const { lastFrame } = render(
        <MessageList
          messages={[]}
          availableRows={10}
          scrollEnabled={false}
        />
      );

      expect(lastFrame()).toContain('暂无消息');
    });
  });

  describe('基本消息渲染', () => {
    it('should render single message', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Hello', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('Hello');
    });

    it('should render multiple messages', () => {
      const now = Date.now();
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Hello', now),
        createMessage('msg-2', 'assistant', 'Hi there!', now + 1000),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('Hello');
      expect(lastFrame()).toContain('Hi there!');
    });
  });

  describe('日期分组', () => {
    it('should group messages by date', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const todayTimestamp = today.getTime();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayTimestamp = yesterday.getTime();

      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Today message', todayTimestamp),
        createMessage('msg-2', 'user', 'Yesterday message', yesterdayTimestamp),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      // Should show both date labels
      expect(lastFrame()).toContain('今天');
      expect(lastFrame()).toContain('昨天');
    });

    it('should render date dividers', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const todayTimestamp = today.getTime();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayTimestamp = yesterday.getTime();

      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'First', yesterdayTimestamp),
        createMessage('msg-2', 'user', 'Second', todayTimestamp),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('───');
    });
  });

  describe('Props 配置', () => {
    it('should accept scrollEnabled prop', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Test', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
          scrollEnabled={true}
        />
      );

      expect(lastFrame()).toContain('Test');
    });

    it('should accept isModalOpen prop', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Test', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
          isModalOpen={true}
        />
      );

      expect(lastFrame()).toContain('Test');
    });

    it('should use default scrollEnabled as true', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Test', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('Test');
    });

    it('should use default isModalOpen as false', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Test', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
          isModalOpen={false}
        />
      );

      expect(lastFrame()).toContain('Test');
    });
  });

  describe('消息状态渲染', () => {
    it('should render streaming message', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'assistant', 'Streaming...', Date.now(), 'streaming'),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('Streaming...');
    });

    it('should render error message', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'error', 'Error occurred', Date.now(), 'error'),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={20}
        />
      );

      expect(lastFrame()).toContain('Error occurred');
    });
  });

  describe('availableRows', () => {
    it('should render with different availableRows values', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Test', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={5}
        />
      );

      expect(lastFrame()).toContain('Test');
    });

    it('should render with large availableRows', () => {
      const messages: ChatMessage[] = [
        createMessage('msg-1', 'user', 'Test', Date.now()),
      ];

      const { lastFrame } = render(
        <MessageList
          messages={messages}
          availableRows={100}
        />
      );

      expect(lastFrame()).toContain('Test');
    });
  });
});
