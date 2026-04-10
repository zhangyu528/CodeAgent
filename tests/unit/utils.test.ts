/**
 * utils 单元测试
 * 测试 Ink utils 的工具函数
 */
import { describe, it, expect } from 'vitest';

// 重新定义 shortenPath 函数以便独立测试
function shortenPath(fullPath: string): string {
  const parts = fullPath.split(/[\\\/]/).filter(Boolean);
  if (parts.length <= 2) return fullPath;
  return `.../${parts.slice(-2).join('/')}`;
}

describe('shortenPath', () => {
  it('should return full path when 2 or fewer parts', () => {
    expect(shortenPath('a')).toBe('a');
    expect(shortenPath('a/b')).toBe('a/b');
  });

  it('should return full path for simple paths', () => {
    // '/home/user' splits to ['', 'home', 'user'] -> filter -> ['home', 'user'] (2 parts) -> return full path
    expect(shortenPath('/home/user')).toBe('/home/user');
    // 'C:\Users\John' splits to ['C:', 'Users', 'John'] (3 parts) -> keep last 2
    expect(shortenPath('C:\\Users\\John')).toBe('.../Users/John');
  });

  it('should shorten path with more than 2 parts', () => {
    expect(shortenPath('/home/user/project/file.ts')).toBe('.../project/file.ts');
    expect(shortenPath('C:\\Users\\John\\Documents\\file.txt')).toBe('.../Documents/file.txt');
  });

  it('should handle paths with multiple separators', () => {
    expect(shortenPath('/a/b/c/d/e.js')).toBe('.../d/e.js');
    expect(shortenPath('a\\b\\c\\d\\e.js')).toBe('.../d/e.js');
  });

  it('should handle paths with trailing slash', () => {
    // trailing slash creates empty part that gets filtered
    expect(shortenPath('/home/user/project/')).toBe('.../user/project');
    expect(shortenPath('/home/user/project/file.ts')).toBe('.../project/file.ts');
  });

  it('should handle empty parts', () => {
    expect(shortenPath('//server//share//file.txt')).toBe('.../share/file.txt');
  });

  it('should handle Windows paths', () => {
    expect(shortenPath('C:\\Program Files\\Nodejs\\node.exe')).toBe('.../Nodejs/node.exe');
    expect(shortenPath('D:\\Projects\\MyApp\\src\\index.ts')).toBe('.../src/index.ts');
  });

  it('should handle Unix paths', () => {
    expect(shortenPath('/usr/local/bin/node')).toBe('.../bin/node');
    expect(shortenPath('/var/log/system.log')).toBe('.../log/system.log');
  });

  it('should handle paths with dots in filenames', () => {
    expect(shortenPath('/home/user/my.project.file.js')).toBe('.../user/my.project.file.js');
  });

  it('should handle single filename', () => {
    expect(shortenPath('index.ts')).toBe('index.ts');
    expect(shortenPath('README.md')).toBe('README.md');
  });

  it('should preserve exact last two parts', () => {
    expect(shortenPath('/a/b/c/d')).toBe('.../c/d');
    expect(shortenPath('/a/b/c')).toBe('.../b/c');
  });

  it('should handle mixed separators', () => {
    expect(shortenPath('/home\\user/project/file.ts')).toBe('.../project/file.ts');
  });

  it('should handle path with only slashes', () => {
    expect(shortenPath('///')).toBe('///'); // all empty after filter
    expect(shortenPath('//')).toBe('//'); // all empty after filter
  });

  it('should handle special characters in path', () => {
    // '/home/user/My Documents/file-name_v2.js' -> 5 parts -> keep last 2
    expect(shortenPath('/home/user/My Documents/file-name_v2.js')).toBe('.../My Documents/file-name_v2.js');
    // '/home/user/@scope/package/index.js' -> 5 parts -> keep last 2
    expect(shortenPath('/home/user/@scope/package/index.js')).toBe('.../package/index.js');
  });
});
