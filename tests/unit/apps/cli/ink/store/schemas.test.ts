import { describe, it, expect } from 'vitest';
import {
  ChatMessageBlockSchema,
  ChatMessageSchema,
  ChatSessionInfoSchema,
  MessageStoreStateSchema,
  ChatMessagePartialSchema,
} from '../../../../../../src/apps/cli/ink/store/schemas.js';

describe('ChatMessageBlockSchema', () => {
  it('parses valid text block', () => {
    const result = ChatMessageBlockSchema.safeParse({ kind: 'text', text: 'hello' });
    expect(result.success).toBe(true);
  });

  it('parses valid thinking block with collapsed', () => {
    const result = ChatMessageBlockSchema.safeParse({
      kind: 'thinking',
      text: 'thinking...',
      collapsed: true,
    });
    expect(result.success).toBe(true);
  });

  it('parses valid reasoning block', () => {
    const result = ChatMessageBlockSchema.safeParse({ kind: 'reasoning', text: 'reasoning...' });
    expect(result.success).toBe(true);
  });

  it('parses valid toolSummary block', () => {
    const result = ChatMessageBlockSchema.safeParse({
      kind: 'toolSummary',
      text: 'tool output',
      collapsed: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects block with unknown kind', () => {
    const result = ChatMessageBlockSchema.safeParse({ kind: 'unknown', text: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects text block without text field', () => {
    const result = ChatMessageBlockSchema.safeParse({ kind: 'text' });
    expect(result.success).toBe(false);
  });
});

describe('ChatMessageSchema', () => {
  const validMessage = {
    id: 'msg-1',
    role: 'user' as const,
    title: 'Test Message',
    createdAt: Date.now(),
    blocks: [{ kind: 'text', text: 'hello' }],
  };

  it('parses valid ChatMessage', () => {
    const result = ChatMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
  });

  it('parses message with optional status', () => {
    const result = ChatMessageSchema.safeParse({ ...validMessage, status: 'streaming' });
    expect(result.success).toBe(true);
  });

  it('parses message with all valid roles', () => {
    for (const role of ['user', 'assistant', 'system', 'error'] as const) {
      const result = ChatMessageSchema.safeParse({ ...validMessage, role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = ChatMessageSchema.safeParse({ ...validMessage, role: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects message without id', () => {
    const { id, ...withoutId } = validMessage;
    const result = ChatMessageSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('rejects message without blocks', () => {
    const { blocks, ...withoutBlocks } = validMessage;
    const result = ChatMessageSchema.safeParse(withoutBlocks);
    expect(result.success).toBe(false);
  });

  it('rejects invalid block in blocks array', () => {
    const result = ChatMessageSchema.safeParse({
      ...validMessage,
      blocks: [{ kind: 'invalid', text: 'test' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status value', () => {
    const result = ChatMessageSchema.safeParse({ ...validMessage, status: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('ChatSessionInfoSchema', () => {
  const validSession = {
    id: 'sess-1',
    title: 'Test Session',
    status: 'active',
    updatedAt: Date.now(),
    messageCount: 5,
  };

  it('parses valid ChatSessionInfo', () => {
    const result = ChatSessionInfoSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it('rejects session without id', () => {
    const { id, ...withoutId } = validSession;
    const result = ChatSessionInfoSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('accepts session with zero messageCount', () => {
    const result = ChatSessionInfoSchema.safeParse({ ...validSession, messageCount: 0 });
    expect(result.success).toBe(true);
  });
});

describe('MessageStoreStateSchema', () => {
  it('parses valid state with null usage', () => {
    const result = MessageStoreStateSchema.safeParse({
      messages: [],
      thinking: false,
      usage: null,
    });
    expect(result.success).toBe(true);
  });

  it('parses valid state with usage', () => {
    const result = MessageStoreStateSchema.safeParse({
      messages: [],
      thinking: false,
      usage: { input: 100, output: 200, cost: 0.05 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects thinking as string', () => {
    const result = MessageStoreStateSchema.safeParse({
      messages: [],
      thinking: 'yes',
      usage: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('ChatMessagePartialSchema', () => {
  it('parses partial message with only id', () => {
    const result = ChatMessagePartialSchema.safeParse({ id: 'msg-1' });
    expect(result.success).toBe(true);
  });

  it('parses partial message with only status', () => {
    const result = ChatMessagePartialSchema.safeParse({ status: 'completed' });
    expect(result.success).toBe(true);
  });

  it('parses partial message with multiple fields', () => {
    const result = ChatMessagePartialSchema.safeParse({
      id: 'msg-1',
      role: 'assistant',
      status: 'streaming',
    });
    expect(result.success).toBe(true);
  });
});
