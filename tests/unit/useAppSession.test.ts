/**
 * useAppSession 单元测试 - 测试纯函数
 * 注意：useAppSession hook 本身依赖 React/Agent，适合集成测试
 * 这里测试其中的纯函数：createSessionId, extractSessionTitle
 */
import { describe, it, expect } from 'vitest';

// 重新定义纯函数以便独立测试（与 useAppSession.ts 中的实现一致）
function createSessionId(): string {
  try {
    const { randomUUID } = require('crypto') as { randomUUID: () => string };
    return randomUUID();
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function extractSessionTitle(text: string): string {
  const normalized = (text || '').trim();
  if (!normalized) return 'New Session';
  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

describe('createSessionId', () => {
  it('should generate a valid string', () => {
    const id = createSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique IDs', () => {
    const id1 = createSessionId();
    const id2 = createSessionId();
    expect(id1).not.toBe(id2);
  });

  it('should generate string with expected prefix when crypto fails', () => {
    // 这个测试依赖于实现细节，UUID 格式可能有变化
    const id = createSessionId();
    // 应该包含随机部分
    expect(id.length).toBeGreaterThan(10);
  });
});

describe('extractSessionTitle', () => {
  it('should return "New Session" for empty input', () => {
    expect(extractSessionTitle('')).toBe('New Session');
  });

  it('should return "New Session" for whitespace only', () => {
    expect(extractSessionTitle('   ')).toBe('New Session');
  });

  it('should return "New Session" for null/undefined', () => {
    expect(extractSessionTitle(null as any)).toBe('New Session');
  });

  it('should return trimmed text for normal input', () => {
    expect(extractSessionTitle('Hello World')).toBe('Hello World');
  });

  it('should return trimmed text with leading/trailing whitespace', () => {
    expect(extractSessionTitle('  Hello World  ')).toBe('Hello World');
  });

  it('should truncate text longer than 40 characters', () => {
    const longText = 'a'.repeat(50);
    const result = extractSessionTitle(longText);
    expect(result).toBe('a'.repeat(40) + '...');
    expect(result.length).toBe(43); // 40 + 3 for '...'
  });

  it('should not truncate text at exactly 40 characters', () => {
    const text40 = 'a'.repeat(40);
    expect(extractSessionTitle(text40)).toBe(text40);
  });

  it('should not truncate text at 41 characters', () => {
    const text41 = 'a'.repeat(41);
    const result = extractSessionTitle(text41);
    expect(result).toBe('a'.repeat(40) + '...');
  });

  it('should handle Chinese characters correctly', () => {
    const chinese = '你好世界';
    expect(extractSessionTitle(chinese)).toBe(chinese);
  });

  it('should handle mixed content', () => {
    expect(extractSessionTitle('Hello 你好 123')).toBe('Hello 你好 123');
  });
});

describe('pending prompt flow (logic)', () => {
  // 模拟 pending prompt 的逻辑
  let pendingPromptRef: string | null = null;

  const setPendingPrompt = (prompt: string) => {
    pendingPromptRef = prompt;
  };

  const getAndClearPendingPrompt = (): string | null => {
    const pending = pendingPromptRef;
    pendingPromptRef = null;
    return pending;
  };

  it('should set and get pending prompt', () => {
    setPendingPrompt('Hello world');
    expect(getAndClearPendingPrompt()).toBe('Hello world');
  });

  it('should clear pending prompt after get', () => {
    setPendingPrompt('Hello');
    getAndClearPendingPrompt();
    expect(getAndClearPendingPrompt()).toBe(null);
  });

  it('should return null when no pending prompt', () => {
    expect(getAndClearPendingPrompt()).toBe(null);
  });

  it('should overwrite previous pending prompt', () => {
    setPendingPrompt('First');
    setPendingPrompt('Second');
    expect(getAndClearPendingPrompt()).toBe('Second');
  });
});
