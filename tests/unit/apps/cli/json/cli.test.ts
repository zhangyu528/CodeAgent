import { describe, it, expect } from 'vitest';
import { parseFlags } from '../../../../../src/apps/cli/json/flags';

describe('CLI entry point integration', () => {
  describe('parseFlags integration', () => {
    it('should detect --json flag for non-interactive mode', () => {
      const flags = parseFlags(['--json']);
      expect(flags.json).toBe(true);
    });

    it('should extract prompt for non-interactive mode', () => {
      const flags = parseFlags(['--json', '--prompt', 'fix the bug in main.ts']);
      expect(flags.prompt).toBe('fix the bug in main.ts');
    });

    it('should allow combining session with prompt', () => {
      const flags = parseFlags(['--json', '--session', 'my-session', '--prompt', 'hello']);
      expect(flags.session).toBe('my-session');
      expect(flags.prompt).toBe('hello');
    });

    it('should handle empty argv (interactive mode default)', () => {
      const flags = parseFlags([]);
      expect(flags.json).toBe(false);
      expect(flags.prompt).toBeUndefined();
    });
  });
});
