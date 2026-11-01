import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      TZ: 'UTC',
    },
    setupFiles: ['./vitest.setup.js'],
    include: ['**/*.spec.{js,jsx}'],
    exclude: ['node_modules/**', 'dist/**', 'prod/**', 'out/**'],
  },
});
