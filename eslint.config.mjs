import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'doc/**',
      'playwright-report/**',
      'scripts/**',
      'src/eliza.html',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.es2022,
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
  {
    files: ['postcss.config.cjs', 'vite.config.ts', 'tailwind.config.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
