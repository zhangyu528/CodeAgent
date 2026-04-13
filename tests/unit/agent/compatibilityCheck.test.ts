import { describe, it, expect } from 'vitest';
import { runCompatibilityCheck } from '../../../src/agent/compatibilityCheck';

describe('compatibilityCheck', () => {
  describe('runCompatibilityCheck', () => {
    it('should return ok true when all checks pass', () => {
      const result = runCompatibilityCheck();
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should include Zod compatibility check', () => {
      const result = runCompatibilityCheck();
      const zodCheck = result.checks.find((c) => c.name === 'Zod Compatibility');
      expect(zodCheck).toBeDefined();
      expect(zodCheck?.ok).toBe(true);
    });

    it('should include Node.js version check', () => {
      const result = runCompatibilityCheck();
      const nodeCheck = result.checks.find((c) => c.name === 'Node.js Version');
      expect(nodeCheck).toBeDefined();
      expect(nodeCheck?.ok).toBe(true);
    });
  });
});
