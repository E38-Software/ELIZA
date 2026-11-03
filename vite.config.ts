import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'e2e/**', '**/*.e2e.{test,spec}.ts'],
  },
});
