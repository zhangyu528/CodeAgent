/**
 * useSlashCommands 单元测试
 * 测试斜杠命令相关的类型、常量和工具函数
 */
import { describe, it, expect } from 'vitest';

// 导入被测试的函数和常量
import { SLASH_COMMANDS, HELP_MESSAGE } from '../../src/apps/cli/ink/components/inputs/useSlashCommands';
import type { SlashListViewItem } from '../../src/apps/cli/ink/components/inputs/useSlashCommands';

describe('SLASH_COMMANDS', () => {
  it('should have 6 commands', () => {
    expect(SLASH_COMMANDS).toHaveLength(6);
  });

  it('should contain /help command', () => {
    const help = SLASH_COMMANDS.find(c => c.name === '/help');
    expect(help).toBeDefined();
    expect(help?.description).toBe('Show available commands');
    expect(help?.category).toBe('general');
  });

  it('should contain /new command', () => {
    const cmd = SLASH_COMMANDS.find(c => c.name === '/new');
    expect(cmd).toBeDefined();
    expect(cmd?.description).toBe('Create and switch to new session');
    expect(cmd?.category).toBe('session');
  });

  it('should contain /model command', () => {
    const cmd = SLASH_COMMANDS.find(c => c.name === '/model');
    expect(cmd).toBeDefined();
    expect(cmd?.description).toBe('Select LLM provider and model');
    expect(cmd?.category).toBe('config');
  });

  it('should contain /history command', () => {
    const cmd = SLASH_COMMANDS.find(c => c.name === '/history');
    expect(cmd).toBeDefined();
    expect(cmd?.description).toBe('View session history');
    expect(cmd?.category).toBe('session');
  });

  it('should contain /resume command', () => {
    const cmd = SLASH_COMMANDS.find(c => c.name === '/resume');
    expect(cmd).toBeDefined();
    expect(cmd?.description).toBe('Continue last session');
    expect(cmd?.category).toBe('session');
  });

  it('should contain /quit command', () => {
    const cmd = SLASH_COMMANDS.find(c => c.name === '/quit');
    expect(cmd).toBeDefined();
    expect(cmd?.description).toBe('Exit the application');
    expect(cmd?.category).toBe('general');
  });

  it('should have valid categories', () => {
    const categories = SLASH_COMMANDS.map(c => c.category);
    expect(categories).toContain('general');
    expect(categories).toContain('session');
    expect(categories).toContain('config');
  });

  it('should have unique command names', () => {
    const names = SLASH_COMMANDS.map(c => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have all commands starting with /', () => {
    SLASH_COMMANDS.forEach(cmd => {
      expect(cmd.name.startsWith('/')).toBe(true);
    });
  });

  it('should have non-empty descriptions', () => {
    SLASH_COMMANDS.forEach(cmd => {
      expect(cmd.description.length).toBeGreaterThan(0);
    });
  });
});

describe('HELP_MESSAGE', () => {
  it('should contain all commands', () => {
    expect(HELP_MESSAGE).toContain('/help');
    expect(HELP_MESSAGE).toContain('/new');
    expect(HELP_MESSAGE).toContain('/model');
    expect(HELP_MESSAGE).toContain('/history');
    expect(HELP_MESSAGE).toContain('/resume');
    expect(HELP_MESSAGE).toContain('/quit');
  });

  it('should contain command descriptions', () => {
    expect(HELP_MESSAGE).toContain('Available Commands:');
    expect(HELP_MESSAGE).toContain('Show this message');
    expect(HELP_MESSAGE).toContain('Start a new session');
    expect(HELP_MESSAGE).toContain('Configure LLM model');
    expect(HELP_MESSAGE).toContain('Browse session history');
    expect(HELP_MESSAGE).toContain('Resume last session');
    expect(HELP_MESSAGE).toContain('Exit application');
  });

  it('should be a non-empty string', () => {
    expect(HELP_MESSAGE.length).toBeGreaterThan(0);
  });
});

describe('SlashListViewItem interface', () => {
  it('should accept valid SlashListViewItem objects', () => {
    const item: SlashListViewItem = {
      name: '/test',
      description: 'Test command',
      category: 'general',
    };

    expect(item.name).toBe('/test');
    expect(item.description).toBe('Test command');
    expect(item.category).toBe('general');
  });

  it('should accept different categories', () => {
    const categories: SlashListViewItem['category'][] = ['general', 'session', 'config'];

    categories.forEach(cat => {
      const item: SlashListViewItem = { name: '/cmd', description: 'desc', category: cat };
      expect(item.category).toBe(cat);
    });
  });
});

describe('command name validation', () => {
  it('should validate command names', () => {
    const isValidCommandName = (name: string): boolean => {
      return SLASH_COMMANDS.some(cmd => cmd.name === name);
    };

    expect(isValidCommandName('/help')).toBe(true);
    expect(isValidCommandName('/new')).toBe(true);
    expect(isValidCommandName('/model')).toBe(true);
    expect(isValidCommandName('/history')).toBe(true);
    expect(isValidCommandName('/resume')).toBe(true);
    expect(isValidCommandName('/quit')).toBe(true);
  });

  it('should reject invalid command names', () => {
    const isValidCommandName = (name: string): boolean => {
      return SLASH_COMMANDS.some(cmd => cmd.name === name);
    };

    expect(isValidCommandName('/invalid')).toBe(false);
    expect(isValidCommandName('/h')).toBe(false);
    expect(isValidCommandName('')).toBe(false);
    expect(isValidCommandName('help')).toBe(false);
  });
});

describe('command filtering by category', () => {
  it('should filter by general category', () => {
    const generalCommands = SLASH_COMMANDS.filter(cmd => cmd.category === 'general');
    expect(generalCommands).toHaveLength(2);
    expect(generalCommands.map(c => c.name)).toContain('/help');
    expect(generalCommands.map(c => c.name)).toContain('/quit');
  });

  it('should filter by session category', () => {
    const sessionCommands = SLASH_COMMANDS.filter(cmd => cmd.category === 'session');
    expect(sessionCommands).toHaveLength(3);
    expect(sessionCommands.map(c => c.name)).toContain('/new');
    expect(sessionCommands.map(c => c.name)).toContain('/history');
    expect(sessionCommands.map(c => c.name)).toContain('/resume');
  });

  it('should filter by config category', () => {
    const configCommands = SLASH_COMMANDS.filter(cmd => cmd.category === 'config');
    expect(configCommands).toHaveLength(1);
    expect(configCommands[0].name).toBe('/model');
  });
});

describe('command search', () => {
  it('should find command by exact name', () => {
    const findCommand = (name: string): SlashListViewItem | undefined => {
      return SLASH_COMMANDS.find(cmd => cmd.name === name);
    };

    expect(findCommand('/help')?.description).toBe('Show available commands');
    expect(findCommand('/new')?.description).toBe('Create and switch to new session');
  });

  it('should not find non-existent command', () => {
    const findCommand = (name: string): SlashListViewItem | undefined => {
      return SLASH_COMMANDS.find(cmd => cmd.name === name);
    };

    expect(findCommand('/invalid')).toBeUndefined();
    expect(findCommand('')).toBeUndefined();
    expect(findCommand('help')).toBeUndefined();
  });
});

describe('command autocomplete prefix matching', () => {
  it('should find prefix matches', () => {
    const findPrefixMatches = (prefix: string): SlashListViewItem[] => {
      if (!prefix.startsWith('/')) return [];
      return SLASH_COMMANDS.filter(cmd => cmd.name.startsWith(prefix));
    };

    expect(findPrefixMatches('/h')).toHaveLength(2); // /help, /history
    expect(findPrefixMatches('/he')).toHaveLength(1); // /help
    expect(findPrefixMatches('/his')).toHaveLength(1); // /history
    expect(findPrefixMatches('/')).toHaveLength(6); // all commands
  });

  it('should return empty for non-slash prefix', () => {
    const findPrefixMatches = (prefix: string): SlashListViewItem[] => {
      if (!prefix.startsWith('/')) return [];
      return SLASH_COMMANDS.filter(cmd => cmd.name.startsWith(prefix));
    };

    expect(findPrefixMatches('h')).toHaveLength(0);
    expect(findPrefixMatches('help')).toHaveLength(0);
    expect(findPrefixMatches('')).toHaveLength(0);
  });
});
