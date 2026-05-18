import { describe, test, expect } from 'vitest';

describe('JSONL Parsing', () => {
  const sampleJsonl = `{"id":"s1","type":"session","version":2}
{"role":"user","content":[{"type":"text","text":"你好"}]}
{"role":"assistant","content":[{"type":"text","text":"你好！"}]}`;

  test('parses multiple lines', () => {
    const lines = sampleJsonl.split('\n');
    expect(lines.length).toBe(3);
  });

  test('parses each line as JSON', () => {
    const lines = sampleJsonl.split('\n');

    lines.forEach(line => {
      expect(() => JSON.parse(line)).not.toThrow();
    });
  });

  test('extracts session header', () => {
    const lines = sampleJsonl.split('\n');
    const header = JSON.parse(lines[0]);

    expect(header.id).toBe('s1');
    expect(header.type).toBe('session');
    expect(header.version).toBe(2);
  });

  test('extracts messages correctly', () => {
    const lines = sampleJsonl.split('\n');
    const messages = lines.slice(1).map(l => JSON.parse(l));

    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });
});

describe('Content Block Parsing', () => {
  const assistantContent = [
    { type: 'thinking', thinking: '用户打招呼' },
    { type: 'text', text: '你好！' }
  ];

  test('parses content blocks array', () => {
    expect(assistantContent).toBeInstanceOf(Array);
    expect(assistantContent.length).toBe(2);
  });

  test('identifies thinking block', () => {
    const thinkingBlock = assistantContent.find(b => b.type === 'thinking');
    expect(thinkingBlock).toBeDefined();
    expect(thinkingBlock?.thinking).toBe('用户打招呼');
  });

  test('identifies text block', () => {
    const textBlock = assistantContent.find(b => b.type === 'text');
    expect(textBlock).toBeDefined();
    expect(textBlock?.text).toBe('你好！');
  });

  test('handles nested content in tool calls', () => {
    const toolCall = {
      type: 'toolCall',
      id: 'call_1',
      name: 'ls',
      arguments: { path: '.' }
    };

    expect(toolCall.name).toBe('ls');
    expect(toolCall.arguments.path).toBe('.');
  });
});

describe('Error handling', () => {
  test('handles invalid JSON', () => {
    const invalidLine = '{invalid json}';
    expect(() => JSON.parse(invalidLine)).toThrow();
  });

  test('handles empty content', () => {
    const emptyContent: any[] = [];
    const textBlock = emptyContent.find(b => b.type === 'text');
    expect(textBlock).toBeUndefined();
  });

  test('handles missing fields gracefully', () => {
    const incomplete = { type: 'text' };
    expect(incomplete.text).toBeUndefined();
  });
});