/**
 * Zod Compatibility Runtime Tests
 * Verifies Zod version detection works correctly when pi-agent-core is loaded.
 * Tests both Zod 3 and Zod 4 detection paths.
 */
import { describe, it, expect } from 'vitest';
import { getZodVersion, isZod4 } from '../../src/agent/zod-compat.js';

describe('zod-compat', () => {
  describe('getZodVersion()', () => {
    it('should return a version string', () => {
      const version = getZodVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should return a version that looks valid (X.Y.Z format)', () => {
      const version = getZodVersion();
      // Accept both X.Y.Z and X.Y.Z-alpha format
      expect(version).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/);
    });

    it('should not return "unknown"', () => {
      const version = getZodVersion();
      expect(version).not.toBe('unknown');
    });
  });

  describe('isZod4()', () => {
    it('should return a boolean', () => {
      const result = isZod4();
      expect(typeof result).toBe('boolean');
    });

    it('should be consistent across multiple calls', () => {
      const first = isZod4();
      const second = isZod4();
      expect(first).toBe(second);
    });

    it('should return true when version starts with 4', () => {
      const version = getZodVersion();
      if (version.startsWith('4.')) {
        expect(isZod4()).toBe(true);
      }
    });

    it('should return false when version does not start with 4', () => {
      const version = getZodVersion();
      if (!version.startsWith('4.')) {
        expect(isZod4()).toBe(false);
      }
    });
  });
});
