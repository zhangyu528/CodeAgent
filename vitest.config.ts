import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/apps/cli/ink/**/*.{ts,tsx}'],
      exclude: [
        'src/apps/cli/ink/**/*.d.ts',
        'src/apps/cli/ink/test-input.ts',
      ],
    },
  },
});
