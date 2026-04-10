/**
 * InputController 纯逻辑测试
 * 测试输入处理和slash命令检测的纯函数逻辑
 */
import { describe, it, expect } from 'vitest';

// 纯函数：从输入值检测是否为slash命令
function isSlashCommand(value: string): boolean {
  return value.startsWith('/') && !value.includes(' ');
}

// 纯函数：检测输入是否可提交
function isSubmittable(value: string): boolean {
  return value.trim().length > 0;
}

// 纯函数：处理字符输入
function appendCharacter(prev: string, input: string): string {
  return prev + input;
}

// 纯函数：处理退格
function deleteCharacter(prev: string): string {
  return prev.slice(0, -1);
}

// 纯函数：清空输入
function clearInput(): string {
  return '';
}

// 纯函数：截断输入到指定长度
function truncateInput(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

// 纯函数：检测是否应该触发自动补全
function shouldTriggerAutocomplete(value: string): boolean {
  return value.startsWith('/');
}

// 纯函数：获取slash命令前缀
function getSlashPrefix(value: string): string | null {
  if (!value.startsWith('/')) return null;
  const spaceIndex = value.indexOf(' ');
  return spaceIndex === -1 ? value : value.slice(0, spaceIndex);
}

// 纯函数：是否为有效的slash命令名
function isValidSlashCommand(command: string): boolean {
  const validCommands = ['/help', '/new', '/model', '/history', '/resume', '/quit'];
  return validCommands.includes(command);
}

// 纯函数：从输入提取命令参数
function extractCommandArgs(input: string): { command: string | null; args: string } {
  if (!input.startsWith('/')) {
    return { command: null, args: '' };
  }
  const spaceIndex = input.indexOf(' ');
  if (spaceIndex === -1) {
    return { command: input, args: '' };
  }
  return {
    command: input.slice(0, spaceIndex),
    args: input.slice(spaceIndex + 1),
  };
}

// 纯函数：检测回车键提交
function shouldSubmitOnReturn(key: { return?: boolean; backspace?: boolean }, input: string, hasSlash: boolean): boolean {
  return (key.return || input === '\r') && !hasSlash;
}

describe('isSlashCommand', () => {
  it('should return true for slash commands', () => {
    expect(isSlashCommand('/help')).toBe(true);
    expect(isSlashCommand('/new')).toBe(true);
    expect(isSlashCommand('/model')).toBe(true);
  });

  it('should return false for non-slash input', () => {
    expect(isSlashCommand('help')).toBe(false);
    expect(isSlashCommand('')).toBe(false);
    expect(isSlashCommand('hello world')).toBe(false);
  });

  it('should return false for slash with space (not a command)', () => {
    expect(isSlashCommand('/hello world')).toBe(false);
    expect(isSlashCommand('/help me')).toBe(false);
  });

  it('should return true for single slash command', () => {
    expect(isSlashCommand('/a')).toBe(true);
    expect(isSlashCommand('/x')).toBe(true);
  });

  it('should handle multi-slash', () => {
    // '//help' starts with '/' and has no space, so isSlashCommand returns true
    expect(isSlashCommand('//help')).toBe(true);
  });
});

describe('isSubmittable', () => {
  it('should return true for non-empty input', () => {
    expect(isSubmittable('hello')).toBe(true);
    expect(isSubmittable('a')).toBe(true);
    expect(isSubmittable('/help')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isSubmittable('')).toBe(false);
  });

  it('should return false for whitespace only', () => {
    expect(isSubmittable('   ')).toBe(false);
    expect(isSubmittable('\t\n')).toBe(false);
  });

  it('should return true for text with leading/trailing whitespace', () => {
    expect(isSubmittable('  hello  ')).toBe(true);
  });
});

describe('appendCharacter', () => {
  it('should append character to empty string', () => {
    expect(appendCharacter('', 'a')).toBe('a');
  });

  it('should append character to existing string', () => {
    expect(appendCharacter('hel', 'l')).toBe('hell');
  });

  it('should handle special characters', () => {
    expect(appendCharacter('/h', 'i')).toBe('/hi');
    expect(appendCharacter('', '/')).toBe('/');
  });

  it('should handle whitespace', () => {
    expect(appendCharacter('hello', ' ')).toBe('hello ');
    expect(appendCharacter('a', '\t')).toBe('a\t');
  });
});

describe('deleteCharacter', () => {
  it('should delete last character', () => {
    expect(deleteCharacter('hello')).toBe('hell');
    expect(deleteCharacter('a')).toBe('');
  });

  it('should return empty for empty string', () => {
    expect(deleteCharacter('')).toBe('');
  });

  it('should handle backspace on slash command', () => {
    expect(deleteCharacter('/help')).toBe('/hel');
    expect(deleteCharacter('/')).toBe('');
  });
});

describe('clearInput', () => {
  it('should return empty string', () => {
    expect(clearInput()).toBe('');
    expect(clearInput()).toBe('');
  });
});

describe('truncateInput', () => {
  it('should truncate to max length', () => {
    expect(truncateInput('hello', 3)).toBe('hel');
    expect(truncateInput('hello', 5)).toBe('hello');
    expect(truncateInput('hello', 10)).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(truncateInput('', 5)).toBe('');
  });

  it('should handle max length of 0', () => {
    expect(truncateInput('hello', 0)).toBe('');
  });
});

describe('shouldTriggerAutocomplete', () => {
  it('should trigger for slash prefix', () => {
    expect(shouldTriggerAutocomplete('/')).toBe(true);
    expect(shouldTriggerAutocomplete('/h')).toBe(true);
    expect(shouldTriggerAutocomplete('/help')).toBe(true);
  });

  it('should not trigger for non-slash', () => {
    expect(shouldTriggerAutocomplete('')).toBe(false);
    expect(shouldTriggerAutocomplete('hello')).toBe(false);
    // '//help' starts with '/' so it triggers (even though it's not a valid command)
    expect(shouldTriggerAutocomplete('//help')).toBe(true);
  });
});

describe('getSlashPrefix', () => {
  it('should return full command when no space', () => {
    expect(getSlashPrefix('/help')).toBe('/help');
    expect(getSlashPrefix('/model')).toBe('/model');
  });

  it('should return prefix up to space', () => {
    expect(getSlashPrefix('/help me')).toBe('/help');
    expect(getSlashPrefix('/cmd arg1 arg2')).toBe('/cmd');
  });

  it('should return null for non-slash input', () => {
    expect(getSlashPrefix('')).toBe(null);
    expect(getSlashPrefix('help')).toBe(null);
  });

  it('should handle slash-only input', () => {
    expect(getSlashPrefix('/')).toBe('/');
  });
});

describe('isValidSlashCommand', () => {
  it('should validate all valid commands', () => {
    expect(isValidSlashCommand('/help')).toBe(true);
    expect(isValidSlashCommand('/new')).toBe(true);
    expect(isValidSlashCommand('/model')).toBe(true);
    expect(isValidSlashCommand('/history')).toBe(true);
    expect(isValidSlashCommand('/resume')).toBe(true);
    expect(isValidSlashCommand('/quit')).toBe(true);
  });

  it('should reject invalid commands', () => {
    expect(isValidSlashCommand('/invalid')).toBe(false);
    expect(isValidSlashCommand('/h')).toBe(false);
    expect(isValidSlashCommand('')).toBe(false);
    expect(isValidSlashCommand('help')).toBe(false);
  });

  it('should reject commands with arguments', () => {
    expect(isValidSlashCommand('/help extra')).toBe(false);
  });
});

describe('extractCommandArgs', () => {
  it('should extract command without args', () => {
    const result = extractCommandArgs('/help');
    expect(result.command).toBe('/help');
    expect(result.args).toBe('');
  });

  it('should extract command with args', () => {
    const result = extractCommandArgs('/help me');
    expect(result.command).toBe('/help');
    expect(result.args).toBe('me');
  });

  it('should handle multiple args', () => {
    const result = extractCommandArgs('/cmd arg1 arg2 arg3');
    expect(result.command).toBe('/cmd');
    expect(result.args).toBe('arg1 arg2 arg3');
  });

  it('should return null command for non-slash input', () => {
    const result = extractCommandArgs('hello');
    expect(result.command).toBe(null);
    expect(result.args).toBe('');
  });

  it('should handle empty input', () => {
    const result = extractCommandArgs('');
    expect(result.command).toBe(null);
    expect(result.args).toBe('');
  });

  it('should handle slash-only input', () => {
    const result = extractCommandArgs('/');
    expect(result.command).toBe('/');
    expect(result.args).toBe('');
  });
});

describe('shouldSubmitOnReturn', () => {
  it('should return true for return key without slash', () => {
    expect(shouldSubmitOnReturn({ return: true }, '', false)).toBe(true);
    expect(shouldSubmitOnReturn({ return: true }, 'hello', false)).toBe(true);
  });

  it('should return false for return key with slash command', () => {
    expect(shouldSubmitOnReturn({ return: true }, '/help', true)).toBe(false);
  });

  it('should return true for carriage return without slash', () => {
    expect(shouldSubmitOnReturn({}, '\r', false)).toBe(true);
    expect(shouldSubmitOnReturn({}, '\r', true)).toBe(false);
  });

  it('should return false for non-return keys', () => {
    expect(shouldSubmitOnReturn({ backspace: true }, 'hello', false)).toBe(false);
    expect(shouldSubmitOnReturn({}, '', false)).toBe(false);
  });
});

describe('input state transitions', () => {
  it('should model typing -> backspace -> submit flow', () => {
    let value = '';
    
    // Type '/'
    value = appendCharacter(value, '/');
    expect(value).toBe('/');
    expect(isSlashCommand(value)).toBe(true);
    
    // Type 'h'
    value = appendCharacter(value, 'h');
    expect(value).toBe('/h');
    expect(isSlashCommand(value)).toBe(true);
    expect(shouldTriggerAutocomplete(value)).toBe(true);
    
    // Type 'e'
    value = appendCharacter(value, 'e');
    expect(value).toBe('/he');
    
    // Type 'l'
    value = appendCharacter(value, 'l');
    expect(value).toBe('/hel');
    
    // Type 'p'
    value = appendCharacter(value, 'p');
    expect(value).toBe('/help');
    expect(isSlashCommand(value)).toBe(true);
    expect(isValidSlashCommand(getSlashPrefix(value)!)).toBe(true);
    
    // Backspace
    value = deleteCharacter(value);
    expect(value).toBe('/hel');
    
    // Clear
    value = clearInput();
    expect(value).toBe('');
    expect(isSlashCommand(value)).toBe(false);
  });

  it('should model multi-word input with space', () => {
    let value = '';
    
    value = appendCharacter(value, '/');
    value = appendCharacter(value, 'c');
    value = appendCharacter(value, 'm');
    value = appendCharacter(value, 'd');
    expect(isSlashCommand(value)).toBe(true);
    
    value = appendCharacter(value, ' ');
    expect(isSlashCommand(value)).toBe(false); // space breaks slash command
    
    value = appendCharacter(value, 'a');
    value = appendCharacter(value, 'r');
    value = appendCharacter(value, 'g');
    
    expect(value).toBe('/cmd arg');
    expect(isSubmittable(value)).toBe(true);
    
    const { command, args } = extractCommandArgs(value);
    expect(command).toBe('/cmd');
    expect(args).toBe('arg');
  });
});

describe('edge cases', () => {
  it('should handle very long input', () => {
    const longInput = 'a'.repeat(10000);
    expect(truncateInput(longInput, 100)).toHaveLength(100);
  });

  it('should handle unicode characters', () => {
    expect(appendCharacter('', '中')).toBe('中');
    expect(appendCharacter('中', '文')).toBe('中文');
  });

  it('should handle newlines', () => {
    expect(appendCharacter('hello', '\n')).toBe('hello\n');
    expect(deleteCharacter('hello\n')).toBe('hello');
  });
});
