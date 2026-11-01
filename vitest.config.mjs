import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./ui', import.meta.url)) },
  },
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
