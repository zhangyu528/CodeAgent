import { describe, it, expect } from 'vitest';
import type { JsonEvent } from '../../../../../src/apps/cli/json/types';

describe('JsonEvent types', () => {
  it('should accept valid response event', () => {
    const event: JsonEvent = {
      type: 'response',
      content: 'Hello world',
      model: 'MiniMax-M2.7',
    };
    expect(event.type).toBe('response');
  });

  it('should accept valid tool_call event', () => {
    const event: JsonEvent = {
      type: 'tool_call',
      tool: 'read_file',
      args: { path: '/test/file.ts' },
    };
    expect(event.type).toBe('tool_call');
    expect(event.tool).toBe('read_file');
  });

  it('should accept valid tool_result event', () => {
    const event: JsonEvent = {
      type: 'tool_result',
      tool: 'read_file',
      result: 'file content here',
      success: true,
    };
    expect(event.type).toBe('tool_result');
    expect(event.success).toBe(true);
  });

  it('should accept valid error event', () => {
    const event: JsonEvent = {
      type: 'error',
      code: 'AUTH_FAILED',
      message: 'Invalid API key provided',
    };
    expect(event.type).toBe('error');
    expect(event.code).toBe('AUTH_FAILED');
  });

  it('should allow undefined args in tool_call', () => {
    const event: JsonEvent = {
      type: 'tool_call',
      tool: 'read_file',
      args: {},
    };
    expect(event.args).toEqual({});
  });

  it('should allow false success in tool_result', () => {
    const event: JsonEvent = {
      type: 'tool_result',
      tool: 'read_file',
      result: 'error message',
      success: false,
    };
    expect(event.success).toBe(false);
  });
});
