/**
 * types.ts 测试
 * 测试类型定义和类型约束
 */
import { describe, it, expect } from 'vitest';
import type {
  ChatMessageRole,
  ChatMessageBlock,
  ChatMessage,
  ChatSessionInfo,
} from '../../src/apps/cli/ink/pages/types.js';

describe('types', () => {
  describe('ChatMessageRole', () => {
    it('should accept user role', () => {
      const role: ChatMessageRole = 'user';
      expect(role).toBe('user');
    });

    it('should accept assistant role', () => {
      const role: ChatMessageRole = 'assistant';
      expect(role).toBe('assistant');
    });

    it('should accept system role', () => {
      const role: ChatMessageRole = 'system';
      expect(role).toBe('system');
    });

    it('should accept error role', () => {
      const role: ChatMessageRole = 'error';
      expect(role).toBe('error');
    });
  });

  describe('ChatMessageBlock', () => {
    it('should accept text block', () => {
      const block: ChatMessageBlock = { kind: 'text', text: 'Hello' };
      expect(block.kind).toBe('text');
      expect(block.text).toBe('Hello');
    });

    it('should accept thinking block', () => {
      const block: ChatMessageBlock = { kind: 'thinking', text: 'Thinking...' };
      expect(block.kind).toBe('thinking');
      expect(block.text).toBe('Thinking...');
    });

    it('should accept thinking block with collapsed', () => {
      const block: ChatMessageBlock = { kind: 'thinking', text: 'Thinking...', collapsed: true };
      expect(block.collapsed).toBe(true);
    });

    it('should accept reasoning block', () => {
      const block: ChatMessageBlock = { kind: 'reasoning', text: 'Reasoning...' };
      expect(block.kind).toBe('reasoning');
      expect(block.text).toBe('Reasoning...');
    });

    it('should accept reasoning block with collapsed', () => {
      const block: ChatMessageBlock = { kind: 'reasoning', text: 'Reasoning...', collapsed: false };
      expect(block.collapsed).toBe(false);
    });

    it('should accept toolSummary block', () => {
      const block: ChatMessageBlock = { kind: 'toolSummary', text: 'Tool used' };
      expect(block.kind).toBe('toolSummary');
      expect(block.text).toBe('Tool used');
    });

    it('should accept toolSummary block with collapsed', () => {
      const block: ChatMessageBlock = { kind: 'toolSummary', text: 'Tool used', collapsed: true };
      expect(block.collapsed).toBe(true);
    });
  });

  describe('ChatMessage', () => {
    it('should accept valid ChatMessage', () => {
      const message: ChatMessage = {
        id: 'msg-123',
        role: 'user',
        title: 'User message',
        createdAt: Date.now(),
        blocks: [{ kind: 'text', text: 'Hello' }],
      };

      expect(message.id).toBe('msg-123');
      expect(message.role).toBe('user');
      expect(message.title).toBe('User message');
      expect(message.blocks.length).toBe(1);
    });

    it('should accept ChatMessage with optional status', () => {
      const message: ChatMessage = {
        id: 'msg-123',
        role: 'assistant',
        title: 'Assistant message',
        createdAt: Date.now(),
        status: 'streaming',
        blocks: [{ kind: 'text', text: 'Thinking...' }],
      };

      expect(message.status).toBe('streaming');
    });

    it('should accept ChatMessage with completed status', () => {
      const message: ChatMessage = {
        id: 'msg-123',
        role: 'assistant',
        title: 'Assistant message',
        createdAt: Date.now(),
        status: 'completed',
        blocks: [{ kind: 'text', text: 'Done' }],
      };

      expect(message.status).toBe('completed');
    });

    it('should accept ChatMessage with error status', () => {
      const message: ChatMessage = {
        id: 'msg-123',
        role: 'error',
        title: 'Error message',
        createdAt: Date.now(),
        status: 'error',
        blocks: [{ kind: 'text', text: 'Something went wrong' }],
      };

      expect(message.status).toBe('error');
    });

    it('should accept ChatMessage with multiple blocks', () => {
      const message: ChatMessage = {
        id: 'msg-123',
        role: 'assistant',
        title: 'Complex message',
        createdAt: Date.now(),
        blocks: [
          { kind: 'thinking', text: 'Thinking...' },
          { kind: 'reasoning', text: 'Reasoning...' },
          { kind: 'text', text: 'Final answer' },
        ],
      };

      expect(message.blocks.length).toBe(3);
    });

    it('should accept ChatMessage with toolSummary block', () => {
      const message: ChatMessage = {
        id: 'msg-123',
        role: 'assistant',
        title: 'Tool message',
        createdAt: Date.now(),
        blocks: [
          { kind: 'toolSummary', text: 'Used tool X' },
          { kind: 'text', text: 'Result' },
        ],
      };

      expect(message.blocks[0].kind).toBe('toolSummary');
    });
  });

  describe('ChatSessionInfo', () => {
    it('should accept valid ChatSessionInfo', () => {
      const session: ChatSessionInfo = {
        id: 'session-123',
        title: 'Test Session',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 5,
      };

      expect(session.id).toBe('session-123');
      expect(session.title).toBe('Test Session');
      expect(session.status).toBe('active');
      expect(session.messageCount).toBe(5);
    });

    it('should accept ChatSessionInfo with inactive status', () => {
      const session: ChatSessionInfo = {
        id: 'session-123',
        title: 'Inactive Session',
        status: 'inactive',
        updatedAt: Date.now(),
        messageCount: 0,
      };

      expect(session.status).toBe('inactive');
    });

    it('should accept ChatSessionInfo with zero messageCount', () => {
      const session: ChatSessionInfo = {
        id: 'session-123',
        title: 'New Session',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 0,
      };

      expect(session.messageCount).toBe(0);
    });

    it('should accept ChatSessionInfo with large messageCount', () => {
      const session: ChatSessionInfo = {
        id: 'session-123',
        title: 'Active Session',
        status: 'active',
        updatedAt: Date.now(),
        messageCount: 1000,
      };

      expect(session.messageCount).toBe(1000);
    });
  });
});
