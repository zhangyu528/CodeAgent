/**
 * Ink 组件测试 - 使用 ink-testing-library
 * 测试 Ink 组件的实际渲染输出
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatHeader } from '../../src/apps/cli/ink/components/chat/ChatHeader.js';
import { DateDivider } from '../../src/apps/cli/ink/components/chat/DateDivider.js';
import { MessageItem } from '../../src/apps/cli/ink/components/chat/MessageItem.js';
import { TypingIndicator } from '../../src/apps/cli/ink/components/chat/TypingIndicator.js';
import { InputField } from '../../src/apps/cli/ink/components/inputs/InputField.js';

// Mock debugStore
vi.mock('../../src/apps/cli/ink/components/debug/debugStore.js', () => ({
  useDebugStore: () => ({
    addMessage: vi.fn(),
    messages: [],
  }),
}));

describe('Ink 组件渲染测试', () => {
  describe('ChatHeader', () => {
    it('should render session info', () => {
      const session = {
        id: 'test-session-123',
        title: 'Test Session',
        status: 'active' as const,
        updatedAt: Date.now(),
        messageCount: 5,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('Test Session');
      expect(lastFrame()).toContain('test-ses'); // truncated id (8 chars)
      expect(lastFrame()).toContain('active');
      expect(lastFrame()).toContain('5 msgs');
    });

    it('should render nothing when session is null', () => {
      const { lastFrame } = render(<ChatHeader session={null} />);

      expect(lastFrame()).toBe('');
    });

    it('should render nothing when session is undefined', () => {
      const { lastFrame } = render(<ChatHeader session={undefined} />);

      expect(lastFrame()).toBe('');
    });
  });

  describe('DateDivider', () => {
    it('should render date label', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      expect(lastFrame()).toContain('今天');
      expect(lastFrame()).toContain('───');
    });

    it('should render yesterday label', () => {
      const { lastFrame } = render(<DateDivider label="昨天" />);

      expect(lastFrame()).toContain('昨天');
    });

    it('should render date string', () => {
      const { lastFrame } = render(<DateDivider label="4月7日" />);

      expect(lastFrame()).toContain('4月7日');
    });
  });

  describe('MessageItem', () => {
    it('should render user message', () => {
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        title: 'You',
        createdAt: Date.now(),
        status: 'completed' as const,
        blocks: [{ kind: 'text' as const, text: 'Hello' }],
      };

      const { lastFrame } = render(<MessageItem message={message} />);

      expect(lastFrame()).toContain('Hello');
    });

    it('should render assistant message', () => {
      const message = {
        id: 'msg-2',
        role: 'assistant' as const,
        title: 'Assistant',
        createdAt: Date.now(),
        status: 'completed' as const,
        blocks: [{ kind: 'text' as const, text: 'Hi there!' }],
      };

      const { lastFrame } = render(<MessageItem message={message} />);

      expect(lastFrame()).toContain('Hi there!');
    });

    it('should render error message', () => {
      const message = {
        id: 'msg-3',
        role: 'error' as const,
        title: 'Error',
        createdAt: Date.now(),
        status: 'error' as const,
        blocks: [{ kind: 'text' as const, text: 'Something went wrong' }],
      };

      const { lastFrame } = render(<MessageItem message={message} />);

      expect(lastFrame()).toContain('Something went wrong');
    });

    it('should render collapsed thinking block', () => {
      const message = {
        id: 'msg-4',
        role: 'assistant' as const,
        title: 'Assistant',
        createdAt: Date.now(),
        status: 'streaming' as const,
        blocks: [
          { kind: 'thinking' as const, text: 'Thinking...', collapsed: true },
          { kind: 'text' as const, text: 'Answer' },
        ],
      };

      const { lastFrame } = render(<MessageItem message={message} />);

      expect(lastFrame()).toContain('[Thinking]');
      expect(lastFrame()).toContain('Answer');
    });
  });

  describe('TypingIndicator', () => {
    it('should render thinking indicator', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      expect(lastFrame()).toContain('thinking...');
    });

    it('should render generating indicator', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={false} isGenerating={true} />
      );

      expect(lastFrame()).toContain('generating...');
    });

    it('should render nothing when idle', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={false} isGenerating={false} />
      );

      expect(lastFrame()).toBe('');
    });
  });

  describe('InputField', () => {
    it('should render placeholder when empty', () => {
      const { lastFrame } = render(
        <InputField value="" placeholder="Ask anything..." />
      );

      expect(lastFrame()).toContain('Ask anything...');
    });

    it('should render value when not empty', () => {
      const { lastFrame } = render(
        <InputField value="Hello world" placeholder="Ask anything..." />
      );

      expect(lastFrame()).toContain('Hello world');
    });

    it('should render cursor', () => {
      const { lastFrame } = render(
        <InputField value="Hi" placeholder="..." />
      );

      // cursor character
      expect(lastFrame()).toContain('▌');
    });

    it('should render different placeholder for chat page', () => {
      const { lastFrame } = render(
        <InputField value="" placeholder="Type a message..." />
      );

      expect(lastFrame()).toContain('Type a message...');
    });
  });
});
