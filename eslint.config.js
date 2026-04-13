import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const config = tseslint.config(
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { console: 'readonly', process: 'readonly' },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
    },
  },
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'tests/'] },
  eslintConfigPrettier,
);

export default config;
