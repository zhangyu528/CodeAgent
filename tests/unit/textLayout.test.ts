/**
 * textLayout 单元测试
 * 测试 textLayout 工具函数
 */
import { describe, it, expect } from 'vitest';
import {
  getDisplayWidth,
  truncateToWidth,
  padToWidth,
  wrapToWidth,
} from '../../src/apps/cli/ink/components/modals/textLayout';

describe('getDisplayWidth', () => {
  it('should return 0 for empty string', () => {
    expect(getDisplayWidth('')).toBe(0);
  });

  it('should return correct width for ASCII characters', () => {
    expect(getDisplayWidth('hello')).toBe(5);
    expect(getDisplayWidth('Hello World')).toBe(11);
    expect(getDisplayWidth('abc')).toBe(3);
  });

  it('should return correct width for numbers and symbols', () => {
    expect(getDisplayWidth('12345')).toBe(5);
    expect(getDisplayWidth('!@#$%')).toBe(5);
    expect(getDisplayWidth('( ) [ ]')).toBe(7); // ( ) [ ] = 7 chars (symbols + spaces)
  });

  it('should return correct width for CJK characters (width 2)', () => {
    expect(getDisplayWidth('中')).toBe(2);
    expect(getDisplayWidth('中文')).toBe(4);
    expect(getDisplayWidth('日本語')).toBe(6);
  });

  it('should return correct width for Korean characters', () => {
    expect(getDisplayWidth('한')).toBe(2);
    expect(getDisplayWidth('한글')).toBe(4);
  });

  it('should return correct width for mixed ASCII and CJK', () => {
    // 'Hello' = 5 ASCII, '中' = 2, '文' = 2, total = 9
    expect(getDisplayWidth('Hello中文')).toBe(9);
    // 'Hi' = 2 ASCII, '你' = 2, '好' = 2, total = 6
    expect(getDisplayWidth('Hi你好')).toBe(6);
  });

  it('should handle fullwidth forms', () => {
    expect(getDisplayWidth('ＡＢＣ')).toBe(6); // 3 fullwidth chars * 2
    expect(getDisplayWidth('％')).toBe(2);
  });

  it('should handle emojis and special Unicode', () => {
    // Emojis fall into else branch (not in CJK ranges), so they get width 1
    expect(getDisplayWidth('🎉')).toBe(1);
    expect(getDisplayWidth('👍')).toBe(1);
  });

  it('should handle whitespace', () => {
    expect(getDisplayWidth('   ')).toBe(3);
    expect(getDisplayWidth('\t')).toBe(1);
    expect(getDisplayWidth('\n')).toBe(1);
  });
});

describe('truncateToWidth', () => {
  it('should return empty string for undefined input', () => {
    expect(truncateToWidth(undefined, 10)).toBe('');
  });

  it('should return empty string for maxWidth <= 0', () => {
    expect(truncateToWidth('hello', 0)).toBe('');
    expect(truncateToWidth('hello', -1)).toBe('');
  });

  it('should return full text if width fits', () => {
    expect(truncateToWidth('hello', 10)).toBe('hello');
    expect(truncateToWidth('hi', 5)).toBe('hi');
  });

  it('should truncate to exact width for ASCII', () => {
    expect(truncateToWidth('hello', 3)).toBe('hel');
    expect(truncateToWidth('hello', 4)).toBe('hell');
    expect(truncateToWidth('hello', 5)).toBe('hello');
  });

  it('should truncate to exact width for CJK', () => {
    expect(truncateToWidth('中文', 2)).toBe('中');
    expect(truncateToWidth('中文', 4)).toBe('中文');
    expect(truncateToWidth('你好世界', 4)).toBe('你好');
  });

  it('should truncate mixed content correctly', () => {
    expect(truncateToWidth('Hello中文', 7)).toBe('Hello中'); // 5 + 2
    expect(truncateToWidth('Hello中文', 6)).toBe('Hello'); // next char (中文) would exceed
  });

  it('should handle single character width', () => {
    expect(truncateToWidth('a', 1)).toBe('a');
    expect(truncateToWidth('a', 0)).toBe('');
  });
});

describe('padToWidth', () => {
  it('should return empty string for undefined input', () => {
    expect(padToWidth(undefined, 10)).toBe('');
  });

  it('should pad text shorter than width', () => {
    expect(padToWidth('hi', 5)).toBe('hi   ');
    expect(padToWidth('a', 3)).toBe('a  ');
  });

  it('should not pad text at exact width', () => {
    expect(padToWidth('hello', 5)).toBe('hello');
  });

  it('should not pad text longer than width', () => {
    expect(padToWidth('hello', 3)).toBe('hel'); // truncated
  });

  it('should handle CJK text with padding', () => {
    expect(padToWidth('中', 4)).toBe('中  '); // width 2 + 2 spaces
    expect(padToWidth('中文', 6)).toBe('中文  '); // width 4 + 2 spaces
  });

  it('should handle mixed content', () => {
    expect(padToWidth('Hi中', 7)).toBe('Hi中   '); // 3 + 4 = 7
  });
});

describe('wrapToWidth', () => {
  it('should return [empty] for width <= 0', () => {
    expect(wrapToWidth('hello', 0)).toEqual(['']);
    expect(wrapToWidth('hello', -1)).toEqual(['']);
  });

  it('should return empty array input as empty line', () => {
    expect(wrapToWidth('', 10)).toEqual(['']);
  });

  it('should not wrap text shorter than width', () => {
    expect(wrapToWidth('hi', 10)).toEqual(['hi']);
    expect(wrapToWidth('hello', 10)).toEqual(['hello']);
  });

  it('should wrap text longer than width', () => {
    expect(wrapToWidth('hello', 3)).toEqual(['hel', 'lo']);
    expect(wrapToWidth('abcdef', 2)).toEqual(['ab', 'cd', 'ef']);
  });

  it('should handle word boundaries at width limit', () => {
    // 'hello world' at width 5: 'hello' fits, ' worl' fits, 'd' starts new line
    const result = wrapToWidth('hello world', 5);
    expect(result).toContain('hello');
    expect(result).toContain(' worl');
    expect(result).toContain('d');
  });

  it('should split newlines into paragraphs', () => {
    expect(wrapToWidth('hello\nworld', 10)).toEqual(['hello', 'world']);
    expect(wrapToWidth('line1\n\nline3', 10)).toEqual(['line1', '', 'line3']);
  });

  it('should handle CRLF line endings', () => {
    expect(wrapToWidth('hello\r\nworld', 10)).toEqual(['hello', 'world']);
  });

  it('should handle empty paragraphs', () => {
    expect(wrapToWidth('\n\n', 10)).toEqual(['', '', '']);
  });

  it('should wrap CJK text correctly', () => {
    const result = wrapToWidth('中文测试', 2);
    expect(result[0]).toBe('中'); // width 2
    expect(result[1]).toBe('文'); // width 2
  });

  it('should handle mixed ASCII and CJK', () => {
    const result = wrapToWidth('Hello世界', 6);
    // 'Hello' = 5, '世' = 2 would exceed 6, so 'Hello' then '世' then '界'
    expect(result).toContain('Hello');
  });

  it('should preserve single empty line', () => {
    expect(wrapToWidth('', 80)).toEqual(['']);
  });
});

describe('edge cases', () => {
  it('should handle very long text', () => {
    const longText = 'a'.repeat(1000);
    const result = wrapToWidth(longText, 10);
    expect(result.length).toBe(100); // 100 lines of 10 chars each
  });

  it('should handle text with only newlines', () => {
    expect(wrapToWidth('\n\n\n', 10)).toEqual(['', '', '', '']);
  });

  it('should handle tabs', () => {
    const result = wrapToWidth('a\tb', 10);
    expect(result[0]).toBe('a	b');
  });
});
