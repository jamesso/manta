import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Run with TZ=America/New_York set before Node starts (see package script test:dashboard-ny). */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./ui', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['app/helpers/__tests__/dashboard.america-new-york.spec.js'],
  },
});
