/**
 * messageAdapters 单元测试
 * 测试消息格式转换逻辑
 */
import { describe, it, expect } from 'vitest';
import { agentMessagesToChatMessages } from '../../src/apps/cli/ink/utils/messageAdapters.js';

// 辅助函数：从实现中复制以便独立测试
function normalizeRole(role: string | undefined) {
  if (role === 'user' || role === 'assistant' || role === 'system' || role === 'error') {
    return role;
  }
  return 'system';
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && typeof item.content === 'string') return item.content;
        if (item && typeof item.input_text === 'string') return item.input_text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  if (content && typeof content === 'object') {
    const value = content as any;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.input_text === 'string') return value.input_text;
  }

  return '';
}

describe('normalizeRole', () => {
  it('should return user for "user"', () => {
    expect(normalizeRole('user')).toBe('user');
  });

  it('should return assistant for "assistant"', () => {
    expect(normalizeRole('assistant')).toBe('assistant');
  });

  it('should return system for "system"', () => {
    expect(normalizeRole('system')).toBe('system');
  });

  it('should return error for "error"', () => {
    expect(normalizeRole('error')).toBe('error');
  });

  it('should return system for unknown role', () => {
    expect(normalizeRole('unknown')).toBe('system');
  });

  it('should return system for undefined', () => {
    expect(normalizeRole(undefined)).toBe('system');
  });
});

describe('extractText', () => {
  it('should return string content as-is', () => {
    expect(extractText('Hello World')).toBe('Hello World');
  });

  it('should return empty string for null', () => {
    expect(extractText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(extractText(undefined)).toBe('');
  });

  it('should extract text from object with text property', () => {
    expect(extractText({ text: 'Hello' })).toBe('Hello');
  });

  it('should extract text from object with content property', () => {
    expect(extractText({ content: 'World' })).toBe('World');
  });

  it('should extract text from object with input_text property', () => {
    expect(extractText({ input_text: 'Test' })).toBe('Test');
  });

  it('should handle array of strings', () => {
    expect(extractText(['Hello', 'World'])).toBe('Hello World');
  });

  it('should handle array of objects with text property', () => {
    expect(extractText([{ text: 'Hello' }, { text: 'World' }])).toBe('Hello World');
  });

  it('should handle mixed array', () => {
    expect(extractText(['Hello', { text: 'World' }])).toBe('Hello World');
  });

  it('should filter empty values from array', () => {
    expect(extractText(['Hello', '', { text: 'World' }])).toBe('Hello World');
  });

  it('should return empty string for empty object', () => {
    expect(extractText({})).toBe('');
  });

  it('should return empty string for array of empty objects', () => {
    expect(extractText([{}, {}])).toBe('');
  });
});

describe('agentMessagesToChatMessages', () => {
  it('should convert user message', () => {
    const agentMessages = [{
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      createdAt: 1000,
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'msg-1',
      role: 'user',
      title: 'You',
      createdAt: 1000,
      status: 'completed',
      blocks: [{ kind: 'text', text: 'Hello' }],
    });
  });

  it('should convert assistant message', () => {
    const agentMessages = [{
      id: 'msg-2',
      role: 'assistant',
      content: 'Hi there!',
      createdAt: 2000,
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0]).toEqual({
      id: 'msg-2',
      role: 'assistant',
      title: 'Assistant',
      createdAt: 2000,
      status: 'completed',
      blocks: [{ kind: 'text', text: 'Hi there!' }],
    });
  });

  it('should convert error message with error status', () => {
    const agentMessages = [{
      id: 'msg-3',
      role: 'error',
      content: 'Something went wrong',
      createdAt: 3000,
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0].role).toBe('error');
    expect(result[0].title).toBe('Error');
    expect(result[0].status).toBe('error');
  });

  it('should convert system message', () => {
    const agentMessages = [{
      id: 'msg-4',
      role: 'system',
      content: 'System prompt',
      createdAt: 4000,
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0].role).toBe('system');
    expect(result[0].title).toBe('System');
  });

  it('should generate id if not provided', () => {
    const agentMessages = [{
      role: 'user',
      content: 'Hello',
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0].id).toBeDefined();
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('should use createdAt from message', () => {
    const agentMessages = [{
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      createdAt: 1234567890,
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0].createdAt).toBe(1234567890);
  });

  it('should handle unknown role as system', () => {
    const agentMessages = [{
      id: 'msg-1',
      role: 'unknown' as any,
      content: 'Hello',
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0].role).toBe('system');
  });

  it('should convert array content', () => {
    const agentMessages = [{
      id: 'msg-1',
      role: 'user',
      content: ['Hello', 'World'],
    }];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result[0].blocks[0].text).toBe('Hello World');
  });

  it('should handle empty messages array', () => {
    const result = agentMessagesToChatMessages([]);
    expect(result).toHaveLength(0);
  });

  it('should handle multiple messages', () => {
    const agentMessages = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi!' },
      { id: '3', role: 'user', content: 'How are you?' },
    ];

    const result = agentMessagesToChatMessages(agentMessages as any);

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });
});
