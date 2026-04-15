import { describe, it, expect } from 'vitest';
import { classifyCommand, DANGEROUS_COMMANDS, ELEVATED_COMMANDS, type CommandTier } from './command-tiers.js';

describe('classifyCommand', () => {
  describe('safe tier', () => {
    it('classifies read-only commands as safe', () => {
      expect(classifyCommand('ls')).toBe('safe');
      expect(classifyCommand('cat')).toBe('safe');
      expect(classifyCommand('grep')).toBe('safe');
      expect(classifyCommand('pwd')).toBe('safe');
    });

    it('classifies git read operations as safe', () => {
      expect(classifyCommand('git status')).toBe('safe');
      expect(classifyCommand('git log')).toBe('safe');
      expect(classifyCommand('git diff')).toBe('safe');
    });

    it('classifies build tools as safe', () => {
      expect(classifyCommand('make')).toBe('safe');
      expect(classifyCommand('cmake')).toBe('safe');
    });
  });

  describe('elevated tier', () => {
    it('classifies git push as elevated', () => {
      expect(classifyCommand('git push')).toBe('elevated');
    });

    it('classifies npm install as elevated', () => {
      expect(classifyCommand('npm install')).toBe('elevated');
    });

    it('classifies package publish as elevated', () => {
      expect(classifyCommand('npm publish')).toBe('elevated');
      expect(classifyCommand('yarn publish')).toBe('elevated');
    });

    it('classifies docker removal as elevated', () => {
      expect(classifyCommand('docker rmi')).toBe('elevated');
      expect(classifyCommand('docker rm')).toBe('elevated');
    });
  });

  describe('dangerous tier', () => {
    it('classifies rm -rf as dangerous', () => {
      expect(classifyCommand('rm -rf /')).toBe('dangerous');
      expect(classifyCommand('rm -rf .')).toBe('dangerous');
    });

    it('classifies dd as dangerous', () => {
      expect(classifyCommand('dd if=/dev/zero')).toBe('dangerous');
    });

    it('classifies mkfs as dangerous', () => {
      expect(classifyCommand('mkfs.ext4')).toBe('dangerous');
    });
  });
});

describe('DANGEROUS_COMMANDS', () => {
  it('includes known destructive commands', () => {
    expect(DANGEROUS_COMMANDS.has('rm')).toBe(true);
    expect(DANGEROUS_COMMANDS.has('dd')).toBe(true);
    expect(DANGEROUS_COMMANDS.has('mkfs')).toBe(true);
  });
});

describe('ELEVATED_COMMANDS', () => {
  it('includes state-modifying commands', () => {
    expect(ELEVATED_COMMANDS.has('git push')).toBe(true);
    expect(ELEVATED_COMMANDS.has('npm install')).toBe(true);
  });
});
