import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/apps/cli/ink/**/*.{ts,tsx}',
        'src/agent/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/apps/cli/ink/**/*.d.ts',
        'src/agent/**/*.d.ts',
      ],
      // Coverage budget — prevents regression in critical modules.
      // Lines and statements at 80% floor; branches at 70% floor.
      // agent/ coverage is intentionally higher than ink/ to protect
      // the security-critical core. Ink components are tested via
      // integration tests; strict line thresholds there would cause
      // CI churn for trivial UI changes.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 70,
        branches: 70,
        perFile: false,
      },
    },
  },
});
