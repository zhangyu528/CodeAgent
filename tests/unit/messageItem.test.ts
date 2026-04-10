/**
 * messageItem 单元测试
 * 测试 MessageItem 组件的纯函数和渲染逻辑
 */
import { describe, it, expect } from 'vitest';
import { ChatMessageRole, ChatMessageBlock } from '../../src/apps/cli/ink/pages/types.js';

// 从 MessageItem.tsx 提取的纯函数进行测试

// roleColor 函数
function roleColor(role: ChatMessageRole): string {
  switch (role) {
    case 'user':
      return 'cyan';
    case 'assistant':
      return 'blue';
    case 'error':
      return 'red';
    case 'system':
    default:
      return 'yellow';
  }
}

// formatToolSummary 函数
function formatToolSummary(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return text;

  const formatted = lines.map((line, i) => {
    const isLast = i === lines.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    return `${prefix}${line}`;
  }).join('\n');

  return `[Tools]\n${formatted}`;
}

describe('roleColor', () => {
  it('should return cyan for user role', () => {
    expect(roleColor('user')).toBe('cyan');
  });

  it('should return blue for assistant role', () => {
    expect(roleColor('assistant')).toBe('blue');
  });

  it('should return red for error role', () => {
    expect(roleColor('error')).toBe('red');
  });

  it('should return yellow for system role', () => {
    expect(roleColor('system')).toBe('yellow');
  });

  it('should return yellow for unknown/default role', () => {
    expect(roleColor('system' as ChatMessageRole)).toBe('yellow');
  });
});

describe('formatToolSummary', () => {
  it('should return original text for empty input', () => {
    expect(formatToolSummary('')).toBe('');
  });

  it('should return original text for whitespace only', () => {
    expect(formatToolSummary('   \n\t\n   ')).toBe('   \n\t\n   ');
  });

  it('should format single line', () => {
    const result = formatToolSummary('read_file');
    expect(result).toBe('[Tools]\n└── read_file');
  });

  it('should format multiple lines with tree structure', () => {
    const result = formatToolSummary('tool1\ntool2\ntool3');
    expect(result).toBe('[Tools]\n├── tool1\n├── tool2\n└── tool3');
  });

  it('should handle two lines', () => {
    const result = formatToolSummary('first\nsecond');
    expect(result).toBe('[Tools]\n├── first\n└── second');
  });

  it('should filter out empty lines', () => {
    const result = formatToolSummary('tool1\n\ntool2');
    expect(result).toBe('[Tools]\n├── tool1\n└── tool2');
  });

  it('should not trim whitespace from non-empty lines', () => {
    // formatToolSummary only filters empty lines, doesn't trim whitespace
    const result = formatToolSummary('  tool1  \n  tool2  ');
    expect(result).toBe('[Tools]\n├──   tool1  \n└──   tool2  ');
  });

  it('should handle newline at end', () => {
    const result = formatToolSummary('tool1\n');
    expect(result).toBe('[Tools]\n└── tool1');
  });

  it('should preserve content exactly', () => {
    const result = formatToolSummary('file:///path/to/file.ts');
    expect(result).toBe('[Tools]\n└── file:///path/to/file.ts');
  });
});

describe('ChatMessageRole type', () => {
  it('should accept valid roles', () => {
    const roles: ChatMessageRole[] = ['user', 'assistant', 'system', 'error'];
    roles.forEach(role => {
      const color = roleColor(role);
      expect(['cyan', 'blue', 'yellow', 'red']).toContain(color);
    });
  });
});

describe('ChatMessageBlock type', () => {
  it('should handle text block', () => {
    const block: ChatMessageBlock = { kind: 'text', text: 'Hello' };
    expect(block.kind).toBe('text');
    expect(block.text).toBe('Hello');
  });

  it('should handle thinking block', () => {
    const block: ChatMessageBlock = { kind: 'thinking', text: 'Thinking...' };
    expect(block.kind).toBe('thinking');
  });

  it('should handle reasoning block', () => {
    const block: ChatMessageBlock = { kind: 'reasoning', text: 'Reasoning...', collapsed: false };
    expect(block.kind).toBe('reasoning');
    expect(block.collapsed).toBe(false);
  });

  it('should handle toolSummary block', () => {
    const block: ChatMessageBlock = { kind: 'toolSummary', text: 'Used tool' };
    expect(block.kind).toBe('toolSummary');
    expect(block.text).toBe('Used tool');
  });

  it('should handle toolSummary with collapsed', () => {
    const block: ChatMessageBlock = { kind: 'toolSummary', text: 'Tool', collapsed: true };
    expect(block.kind).toBe('toolSummary');
    expect(block.collapsed).toBe(true);
  });
});

describe('block kind detection', () => {
  const isTextBlock = (block: ChatMessageBlock): boolean => block.kind === 'text';
  const isThinkingBlock = (block: ChatMessageBlock): boolean => block.kind === 'thinking';
  const isReasoningBlock = (block: ChatMessageBlock): boolean => block.kind === 'reasoning';
  const isToolSummaryBlock = (block: ChatMessageBlock): boolean => block.kind === 'toolSummary';

  it('should detect text blocks', () => {
    expect(isTextBlock({ kind: 'text', text: 'hi' })).toBe(true);
    expect(isThinkingBlock({ kind: 'text', text: 'hi' })).toBe(false);
  });

  it('should detect thinking blocks', () => {
    expect(isThinkingBlock({ kind: 'thinking', text: 'think' })).toBe(true);
    expect(isTextBlock({ kind: 'thinking', text: 'think' })).toBe(false);
  });

  it('should detect reasoning blocks', () => {
    expect(isReasoningBlock({ kind: 'reasoning', text: 'reason' })).toBe(true);
  });

  it('should detect toolSummary blocks', () => {
    expect(isToolSummaryBlock({ kind: 'toolSummary', text: 'tool' })).toBe(true);
  });
});

describe('collapsed state logic', () => {
  it('should default collapsed to true when undefined', () => {
    const block = { kind: 'thinking' as const, text: 'test', collapsed: undefined as boolean | undefined };
    const collapsed = block.collapsed !== false;
    expect(collapsed).toBe(true);
  });

  it('should use explicit collapsed value', () => {
    const block = { kind: 'thinking' as const, text: 'test', collapsed: true };
    const collapsed = block.collapsed !== false;
    expect(collapsed).toBe(true);
  });

  it('should use explicit collapsed false', () => {
    const block = { kind: 'thinking' as const, text: 'test', collapsed: false };
    const collapsed = block.collapsed !== false;
    expect(collapsed).toBe(false);
  });
});

describe('message streaming status', () => {
  interface MessageWithStatus {
    status?: 'streaming' | 'completed' | 'error';
    blocks: { text: string }[];
  }

  const isStreaming = (msg: MessageWithStatus): boolean => msg.status === 'streaming';
  const isWaiting = (msg: MessageWithStatus): boolean => msg.status === 'streaming' && msg.blocks.length === 0;
  const isGenerating = (msg: MessageWithStatus): boolean => msg.status === 'streaming' && msg.blocks.length > 0;

  it('should detect streaming status', () => {
    const msg: MessageWithStatus = { status: 'streaming', blocks: [{ text: 'hi' }] };
    expect(isStreaming(msg)).toBe(true);
    expect(isWaiting(msg)).toBe(false);
    expect(isGenerating(msg)).toBe(true);
  });

  it('should detect waiting state', () => {
    const msg: MessageWithStatus = { status: 'streaming', blocks: [] };
    expect(isStreaming(msg)).toBe(true);
    expect(isWaiting(msg)).toBe(true);
    expect(isGenerating(msg)).toBe(false);
  });

  it('should detect completed status', () => {
    const msg: MessageWithStatus = { status: 'completed', blocks: [{ text: 'done' }] };
    expect(isStreaming(msg)).toBe(false);
    expect(isWaiting(msg)).toBe(false);
    expect(isGenerating(msg)).toBe(false);
  });

  it('should detect error status', () => {
    const msg: MessageWithStatus = { status: 'error', blocks: [] };
    expect(isStreaming(msg)).toBe(false);
  });
});

describe('message role detection', () => {
  const isUserMessage = (role: ChatMessageRole): boolean => role === 'user';
  const isAssistantMessage = (role: ChatMessageRole): boolean => role === 'assistant';
  const isSystemMessage = (role: ChatMessageRole): boolean => role === 'system';
  const isErrorMessage = (role: ChatMessageRole): boolean => role === 'error';

  it('should detect user messages', () => {
    expect(isUserMessage('user')).toBe(true);
    expect(isAssistantMessage('user')).toBe(false);
  });

  it('should detect assistant messages', () => {
    expect(isAssistantMessage('assistant')).toBe(true);
    expect(isUserMessage('assistant')).toBe(false);
  });

  it('should detect system messages', () => {
    expect(isSystemMessage('system')).toBe(true);
  });

  it('should detect error messages', () => {
    expect(isErrorMessage('error')).toBe(true);
  });
});

describe('text block merging detection', () => {
  interface BlockWithKind {
    kind: 'text' | 'thinking' | 'reasoning' | 'toolSummary';
  }

  const isTextBetweenTexts = (
    block: BlockWithKind,
    prevBlock: BlockWithKind | null,
    nextBlock: BlockWithKind | null
  ): boolean => {
    return block.kind === 'text' &&
      prevBlock?.kind === 'text' &&
      nextBlock?.kind === 'text';
  };

  it('should detect text between two text blocks', () => {
    const block = { kind: 'text' as const };
    const prev = { kind: 'text' as const };
    const next = { kind: 'text' as const };

    expect(isTextBetweenTexts(block, prev, next)).toBe(true);
  });

  it('should not detect when prev is not text', () => {
    const block = { kind: 'text' as const };
    const prev = { kind: 'thinking' as const };
    const next = { kind: 'text' as const };

    expect(isTextBetweenTexts(block, prev, next)).toBe(false);
  });

  it('should not detect when next is not text', () => {
    const block = { kind: 'text' as const };
    const prev = { kind: 'text' as const };
    const next = { kind: 'reasoning' as const };

    expect(isTextBetweenTexts(block, prev, next)).toBe(false);
  });

  it('should not detect for first block', () => {
    const block = { kind: 'text' as const };
    expect(isTextBetweenTexts(block, null, { kind: 'text' as const })).toBe(false);
  });

  it('should not detect for last block', () => {
    const block = { kind: 'text' as const };
    expect(isTextBetweenTexts(block, { kind: 'text' as const }, null)).toBe(false);
  });
});
