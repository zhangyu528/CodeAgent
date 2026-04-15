import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emit, setJsonMode, resetEmitter } from '../../../../../src/apps/cli/json/emitter';

describe('emitter', () => {
  let writeOutput: string[] = [];

  beforeEach(() => {
    writeOutput = [];
    // Mock process.stdout.write
    vi.spyOn(process.stdout, 'write').mockImplementation((text: string) => {
      writeOutput.push(text);
      return true;
    });
    resetEmitter();
    setJsonMode(true); // Enable JSON mode for emit tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('emit', () => {
    it('should output a JSON line ending with newline', () => {
      emit({ type: 'response', content: 'hello', model: 'test-model' });
      expect(writeOutput.length).toBe(1);
      expect(writeOutput[0]).toBe('{"type":"response","content":"hello","model":"test-model"}\n');
    });

    it('should output valid JSON that can be parsed', () => {
      emit({ type: 'tool_call', tool: 'read_file', args: { path: '/test' } });
      const parsed = JSON.parse(writeOutput[0].trim());
      expect(parsed.type).toBe('tool_call');
      expect(parsed.tool).toBe('read_file');
      expect(parsed.args.path).toBe('/test');
    });

    it('should output each emit as separate line', () => {
      emit({ type: 'response', content: 'first', model: 'm' });
      emit({ type: 'tool_call', tool: 'test', args: {} });
      emit({ type: 'response', content: 'second', model: 'm' });
      expect(writeOutput.length).toBe(3);
    });

    it('should correctly serialize error type', () => {
      emit({ type: 'error', code: 'AUTH_FAILED', message: 'Invalid API key' });
      const parsed = JSON.parse(writeOutput[0].trim());
      expect(parsed.type).toBe('error');
      expect(parsed.code).toBe('AUTH_FAILED');
      expect(parsed.message).toBe('Invalid API key');
    });
  });

  describe('setJsonMode', () => {
    it('should enable output when setJsonMode(true) is called', () => {
      setJsonMode(true);
      emit({ type: 'response', content: 'hello', model: 'test' });
      expect(writeOutput.length).toBe(1);
    });

    it('should not output when setJsonMode(false)', () => {
      setJsonMode(false);
      emit({ type: 'response', content: 'hello', model: 'test' });
      expect(writeOutput.length).toBe(0);
    });
  });
});
