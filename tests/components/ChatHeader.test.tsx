/**
 * ChatHeader 组件测试
 * 测试聊天头部显示会话信息
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatSessionInfo } from '../../src/apps/cli/ink/pages/types.js';

import { ChatHeader } from '../../src/apps/cli/ink/components/chat/ChatHeader.js';

describe('ChatHeader', () => {
  describe('基本渲染', () => {
    it('should render ChatHeader component', () => {
      const { lastFrame } = render(<ChatHeader session={null} />);

      expect(lastFrame()).toBeDefined();
    });

    it('should render without crashing when session is undefined', () => {
      const { lastFrame } = render(<ChatHeader session={undefined} />);

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('会话信息显示', () => {
    it('should display "No Session" when session is null', () => {
      const { lastFrame } = render(<ChatHeader session={null} />);

      expect(lastFrame()).toContain('No Session');
    });

    it('should display "none" for session id when session is null', () => {
      const { lastFrame } = render(<ChatHeader session={null} />);

      expect(lastFrame()).toContain('#none');
    });

    it('should display "unknown" for status when session is null', () => {
      const { lastFrame } = render(<ChatHeader session={null} />);

      expect(lastFrame()).toContain('unknown');
    });

    it('should display "0 msgs" when session is null', () => {
      const { lastFrame } = render(<ChatHeader session={null} />);

      expect(lastFrame()).toContain('0 msgs');
    });
  });

  describe('会话数据渲染', () => {
    it('should display session title', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'Test Session',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 5,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('Test Session');
    });

    it('should display truncated session id (first 8 chars)', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'Test',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 5,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      // slice(0, 8) takes first 8 chars: 'test-123'
      expect(lastFrame()).toContain('#test-123');
    });

    it('should display session status', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'Test',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 5,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('active');
    });

    it('should display message count', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'Test',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 10,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('10 msgs');
    });

    it('should display "1 msg" (singular) when messageCount is 1', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'Test',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 1,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('1 msgs');
    });
  });

  describe('不同状态', () => {
    it('should display inactive status', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'Test',
        status: 'inactive',
        updatedAt: Date.now(),
        messageCount: 5,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('inactive');
    });

    it('should handle session with zero message count', () => {
      const session: ChatSessionInfo = {
        id: 'test-12345678',
        title: 'New Session',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 0,
      };

      const { lastFrame } = render(<ChatHeader session={session} />);

      expect(lastFrame()).toContain('New Session');
      expect(lastFrame()).toContain('0 msgs');
    });
  });
});
