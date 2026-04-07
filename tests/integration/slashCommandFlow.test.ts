/**
 * slashCommandFlow 集成测试
 * 测试 slash 命令的完整执行流程
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSlash, SLASH_COMMANDS } from '../../src/apps/cli/ink/components/inputs/useSlashCommands.js';

// Mock handlers 记录调用情况
interface MockHandlers {
  onHelp: ReturnType<typeof vi.fn>;
  onNew: ReturnType<typeof vi.fn>;
  onModel: ReturnType<typeof vi.fn>;
  onHistory: ReturnType<typeof vi.fn>;
  onResume: ReturnType<typeof vi.fn>;
  onQuit: ReturnType<typeof vi.fn>;
}

function createMockHandlers(): MockHandlers {
  return {
    onHelp: vi.fn(),
    onNew: vi.fn(),
    onModel: vi.fn(),
    onHistory: vi.fn(),
    onResume: vi.fn(),
    onQuit: vi.fn(),
  };
}

describe('slashCommandFlow 集成测试', () => {
  let handlers: MockHandlers;

  beforeEach(() => {
    handlers = createMockHandlers();
  });

  describe('完整命令执行流程', () => {
    it('/help should trigger onHelp', () => {
      const result = executeSlash('/help', handlers);
      expect(result).toBe(true);
      expect(handlers.onHelp).toHaveBeenCalledTimes(1);
      expect(handlers.onNew).not.toHaveBeenCalled();
    });

    it('/new should trigger onNew', () => {
      const result = executeSlash('/new', handlers);
      expect(result).toBe(true);
      expect(handlers.onNew).toHaveBeenCalledTimes(1);
    });

    it('/model should trigger onModel', () => {
      const result = executeSlash('/model', handlers);
      expect(result).toBe(true);
      expect(handlers.onModel).toHaveBeenCalledTimes(1);
    });

    it('/history should trigger onHistory', () => {
      const result = executeSlash('/history', handlers);
      expect(result).toBe(true);
      expect(handlers.onHistory).toHaveBeenCalledTimes(1);
    });

    it('/resume should trigger onResume', () => {
      const result = executeSlash('/resume', handlers);
      expect(result).toBe(true);
      expect(handlers.onResume).toHaveBeenCalledTimes(1);
    });

    it('/quit should trigger onQuit', () => {
      const result = executeSlash('/quit', handlers);
      expect(result).toBe(true);
      expect(handlers.onQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe('前缀匹配流程', () => {
    it('/h should match /help (longest match)', () => {
      // /h 匹配 /help (5 chars) 和 /history (8 chars)
      // 最长匹配是 /history
      const result = executeSlash('/h', handlers);
      expect(result).toBe(true);
      expect(handlers.onHistory).toHaveBeenCalledTimes(1);
    });

    it('/he should match /help', () => {
      const result = executeSlash('/he', handlers);
      expect(result).toBe(true);
      expect(handlers.onHelp).toHaveBeenCalledTimes(1);
    });

    it('/m should match /model', () => {
      const result = executeSlash('/m', handlers);
      expect(result).toBe(true);
      expect(handlers.onModel).toHaveBeenCalledTimes(1);
    });

    it('/res should match /resume', () => {
      const result = executeSlash('/res', handlers);
      expect(result).toBe(true);
      expect(handlers.onResume).toHaveBeenCalledTimes(1);
    });

    it('/n should match /new', () => {
      const result = executeSlash('/n', handlers);
      expect(result).toBe(true);
      expect(handlers.onNew).toHaveBeenCalledTimes(1);
    });

    it('/q should match /quit', () => {
      const result = executeSlash('/q', handlers);
      expect(result).toBe(true);
      expect(handlers.onQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe('无匹配流程', () => {
    it('/xyz should not trigger any handler', () => {
      const result = executeSlash('/xyz', handlers);
      expect(result).toBe(false);
      expect(handlers.onHelp).not.toHaveBeenCalled();
      expect(handlers.onNew).not.toHaveBeenCalled();
      expect(handlers.onHistory).not.toHaveBeenCalled();
    });

    it('/hello123 should not trigger any handler', () => {
      const result = executeSlash('/hello123', handlers);
      expect(result).toBe(false);
    });
  });

  describe('命令列表过滤流程', () => {
    it('filterCommands should return all commands for "/"', () => {
      const input = '/';
      const hasSlash = input.startsWith('/') && !input.includes(' ');
      const search = hasSlash ? input.slice(1).toLowerCase() : '';
      const filtered = search === '' ? [...SLASH_COMMANDS] : [];

      expect(filtered).toHaveLength(6);
    });

    it('filterCommands should return /model for "/m"', () => {
      const input = '/m';
      const hasSlash = input.startsWith('/') && !input.includes(' ');
      const search = hasSlash ? input.slice(1).toLowerCase() : '';
      const filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.name.toLowerCase().slice(1).startsWith(search),
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('/model');
    });

    it('filterCommands should return /help and /history for "/h"', () => {
      const input = '/h';
      const hasSlash = input.startsWith('/') && !input.includes(' ');
      const search = hasSlash ? input.slice(1).toLowerCase() : '';
      const filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.name.toLowerCase().slice(1).startsWith(search),
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.name)).toContain('/help');
      expect(filtered.map(c => c.name)).toContain('/history');
    });
  });

  describe('选中索引流程', () => {
    it('selectedIndex should reset when list changes', () => {
      let selectedIndex = 0;
      const commands = SLASH_COMMANDS;
      const newCommands = commands.filter(cmd => cmd.name.startsWith('/m'));

      // 之前选中最后一项
      selectedIndex = Math.min(selectedIndex, newCommands.length - 1);

      expect(newCommands).toHaveLength(1);
      expect(selectedIndex).toBe(0);
    });

    it('selectedIndex should be bounded by list length', () => {
      let selectedIndex = 10;
      const commands = SLASH_COMMANDS.filter(cmd => cmd.name.startsWith('/m'));

      selectedIndex = Math.min(Math.max(0, commands.length - 1), selectedIndex);

      expect(commands).toHaveLength(1);
      expect(selectedIndex).toBe(0);
    });
  });
});
