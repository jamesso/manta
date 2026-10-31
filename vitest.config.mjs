import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = p => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Jest used the root __mocks__ folder for these node_modules
    // automatically. Vitest does not, so alias them.
    alias: [
      { find: /^electron$/, replacement: root('./__mocks__/electron.js') },
      { find: /^pouchdb-browser$/, replacement: root('./__mocks__/pouchdb-browser.js') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      TZ: 'UTC',
    },
    setupFiles: ['./vitest.setup.js'],
    include: ['**/*.spec.{js,jsx}'],
    exclude: ['node_modules/**', 'test/**', 'dist/**', 'prod/**', 'out/**'],
  },
});
