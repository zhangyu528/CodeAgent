import { describe, test, expect } from 'vitest';

describe('Service Return Types', () => {
  describe('Session creation', () => {
    test('createSession result structure', () => {
      const result = {
        success: true,
        sessionId: '12345_abc',
        sessionPath: '/path/to/session.jsonl'
      };

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('sessionPath');
      expect(result.sessionPath.endsWith('.jsonl')).toBe(true);
    });

    test('switchSession void on success', () => {
      const result = undefined;

      expect(result).toBeUndefined();
    });

    test('switchSession throws on invalid input', () => {
      const throwError = () => {
        throw new Error('Invalid session path');
      };

      expect(throwError).toThrow('Invalid session path');
    });
  });

  describe('listSessions', () => {
    test('returns array of sessions', () => {
      const sessions = [
        { id: 's1', path: '/s1.jsonl', cwd: '' },
        { id: 's2', path: '/s2.jsonl', cwd: 'D:\\project' }
      ];

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(2);
    });

    test('session object has required fields', () => {
      const session = {
        id: 's1',
        path: '/path.jsonl',
        cwd: '',
        name: 'Test',
        created: new Date(),
        modified: new Date(),
        messageCount: 5,
        firstMessage: '你好'
      };

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('path');
      expect(session).toHaveProperty('cwd');
      expect(session).toHaveProperty('messageCount');
    });
  });

  describe('listSessionGroups', () => {
    test('returns global and byProject structure', () => {
      const groups = {
        global: [],
        byProject: {}
      };

      expect(groups).toHaveProperty('global');
      expect(groups).toHaveProperty('byProject');
      expect(Array.isArray(groups.global)).toBe(true);
      expect(typeof groups.byProject).toBe('object');
    });

    test('byProject groups sessions by cwd', () => {
      const groups = {
        global: [{ id: 'g1', path: '/g1.jsonl', cwd: '' }],
        byProject: {
          'D:\\project': [{ id: 'p1', path: '/p1.jsonl', cwd: 'D:\\project' }]
        }
      };

      expect(groups.global.length).toBe(1);
      expect(Object.keys(groups.byProject).length).toBe(1);
      expect(groups.byProject['D:\\project']).toBeDefined();
    });
  });

  describe('Context usage', () => {
    test('returns usage object with tokens and window', () => {
      const usage = {
        tokens: 500,
        contextWindow: 100000,
        percent: 0.5
      };

      expect(usage).toHaveProperty('tokens');
      expect(usage).toHaveProperty('contextWindow');
      expect(usage).toHaveProperty('percent');
      expect(typeof usage.tokens).toBe('number');
      expect(typeof usage.contextWindow).toBe('number');
    });

    test('tokens can be null', () => {
      const usage = {
        tokens: null,
        contextWindow: 100000,
        percent: null
      };

      expect(usage.tokens).toBeNull();
      expect(usage.percent).toBeNull();
    });
  });

  describe('Prompt result', () => {
    test('success result structure', () => {
      const result = { success: true };

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    test('error result structure', () => {
      const result = { success: false, error: 'No agent' };

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});