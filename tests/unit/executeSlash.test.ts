/**
 * executeSlash 单元测试
 * 测试 slash 命令的精确匹配和前缀匹配逻辑
 */
import { describe, it, expect } from 'vitest';
import { executeSlash, SLASH_COMMANDS } from '../../src/apps/cli/ink/components/inputs/useSlashCommands.js';

describe('executeSlash', () => {
  // Mock handlers
  const handlers = {
    onHelp: () => 'help',
    onNew: () => 'new',
    onModel: () => 'model',
    onHistory: () => 'history',
    onResume: () => 'resume',
    onQuit: () => 'quit',
  };

  // Helper to track which handler was called
  const createMockHandlers = () => {
    const called: string[] = [];
    return {
      handlers: {
        onHelp: () => called.push('help'),
        onNew: () => called.push('new'),
        onModel: () => called.push('model'),
        onHistory: () => called.push('history'),
        onResume: () => called.push('resume'),
        onQuit: () => called.push('quit'),
      },
      called,
    };
  };

  describe('exact match', () => {
    it('should match /help', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/help', handlers);
      expect(result).toBe(true);
      expect(called).toContain('help');
    });

    it('should match /new', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/new', handlers);
      expect(result).toBe(true);
      expect(called).toContain('new');
    });

    it('should match /model', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/model', handlers);
      expect(result).toBe(true);
      expect(called).toContain('model');
    });

    it('should match /history', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/history', handlers);
      expect(result).toBe(true);
      expect(called).toContain('history');
    });

    it('should match /resume', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/resume', handlers);
      expect(result).toBe(true);
      expect(called).toContain('resume');
    });

    it('should match /quit', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/quit', handlers);
      expect(result).toBe(true);
      expect(called).toContain('quit');
    });
  });

  describe('prefix match', () => {
    it('should match /h to /history (longest match)', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/h', handlers);
      expect(result).toBe(true);
      // /h matches both /help and /history, longest match wins
      expect(called).toContain('history');
    });

    it('should match /he to /help (longest match)', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/he', handlers);
      expect(result).toBe(true);
      // /he matches /help (5) but not /history (8), so /help wins
      expect(called).toContain('help');
    });

    it('should match /hel to /help', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/hel', handlers);
      expect(result).toBe(true);
      expect(called).toContain('help');
    });

    it('should match /hi to /history', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/hi', handlers);
      expect(result).toBe(true);
      expect(called).toContain('history');
    });

    it('should match /his to /history', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/his', handlers);
      expect(result).toBe(true);
      expect(called).toContain('history');
    });

    it('should match /res to /resume', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/res', handlers);
      expect(result).toBe(true);
      expect(called).toContain('resume');
    });

    it('should match /re to /resume (not /resume)', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/re', handlers);
      expect(result).toBe(true);
      expect(called).toContain('resume');
    });

    it('should match /m to /model', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/m', handlers);
      expect(result).toBe(true);
      expect(called).toContain('model');
    });

    it('should match /n to /new', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/n', handlers);
      expect(result).toBe(true);
      expect(called).toContain('new');
    });

    it('should match /q to /quit', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/q', handlers);
      expect(result).toBe(true);
      expect(called).toContain('quit');
    });
  });

  describe('no match', () => {
    it('should return false for unknown command', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/unknown', handlers);
      expect(result).toBe(false);
      expect(called).toHaveLength(0);
    });

    it('should return false for partial match that does not match any command', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/xyz', handlers);
      expect(result).toBe(false);
      expect(called).toHaveLength(0);
    });
  });

  describe('ambiguous prefix', () => {
    it('should use longest match when ambiguous', () => {
      const { handlers, called } = createMockHandlers();
      // /he could match /help, but since there's no /he command, it should match /help
      const result = executeSlash('/he', handlers);
      expect(result).toBe(true);
      expect(called).toContain('help');
    });

    it('should prefer exact match over prefix match', () => {
      const { handlers, called } = createMockHandlers();
      const result = executeSlash('/help', handlers);
      expect(result).toBe(true);
      expect(called).toContain('help');
      expect(called).toHaveLength(1);
    });
  });
});

describe('SLASH_COMMANDS', () => {
  it('should have all expected commands', () => {
    const expectedCommands = ['/help', '/new', '/model', '/history', '/resume', '/quit'];
    const commandNames = SLASH_COMMANDS.map(cmd => cmd.name);
    expect(commandNames).toEqual(expectedCommands);
  });

  it('should have description for each command', () => {
    SLASH_COMMANDS.forEach(cmd => {
      expect(cmd.description).toBeDefined();
      expect(cmd.description.length).toBeGreaterThan(0);
    });
  });

  it('should have category for each command', () => {
    SLASH_COMMANDS.forEach(cmd => {
      expect(cmd.category).toBeDefined();
      expect(['general', 'session', 'config']).toContain(cmd.category);
    });
  });
});
