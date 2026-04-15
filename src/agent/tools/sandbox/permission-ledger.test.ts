import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionLedger, type CommandTier } from './permission-ledger.js';

describe('PermissionLedger', () => {
  let ledger: PermissionLedger;

  beforeEach(() => {
    ledger = new PermissionLedger();
  });

  describe('has()', () => {
    it('returns true for safe tier commands by default', () => {
      expect(ledger.has('ls', 'safe')).toBe(true);
      expect(ledger.has('cat', 'safe')).toBe(true);
    });

    it('returns false for elevated tier commands without approval', () => {
      expect(ledger.has('git', 'elevated')).toBe(false);
    });

    it('returns false for dangerous tier commands without approval', () => {
      expect(ledger.has('rm', 'dangerous')).toBe(false);
    });

    it('returns true for elevated tier after approval', () => {
      ledger.approve('git push', 'elevated');
      expect(ledger.has('git push', 'elevated')).toBe(true);
    });

    it('returns true for dangerous tier after approval', () => {
      ledger.approve('rm', 'dangerous');
      expect(ledger.has('rm', 'dangerous')).toBe(true);
    });

    it('returns false for different tier after approval', () => {
      ledger.approve('git push', 'elevated');
      expect(ledger.has('git push', 'safe')).toBe(false);
      expect(ledger.has('git push', 'dangerous')).toBe(false);
    });
  });

  describe('approve()', () => {
    it('stores approval with tier and timestamp', () => {
      const before = Date.now();
      ledger.approve('npm', 'elevated');
      const after = Date.now();

      const entry = ledger.getEntry('npm');
      expect(entry).toBeDefined();
      expect(entry!.tier).toBe('elevated');
      expect(entry!.approvedAt).toBeGreaterThanOrEqual(before);
      expect(entry!.approvedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('clear()', () => {
    it('removes all approvals', () => {
      ledger.approve('git push', 'elevated');
      ledger.approve('npm', 'elevated');
      ledger.clear();

      expect(ledger.has('git push', 'elevated')).toBe(false);
      expect(ledger.has('npm', 'elevated')).toBe(false);
    });
  });

  describe('getEntry()', () => {
    it('returns undefined for unapproved commands', () => {
      expect(ledger.getEntry('ls')).toBeUndefined();
    });

    it('returns the approval entry for approved commands', () => {
      ledger.approve('curl', 'elevated');
      const entry = ledger.getEntry('curl');
      expect(entry).toBeDefined();
      expect(entry!.tier).toBe('elevated');
    });
  });
});
