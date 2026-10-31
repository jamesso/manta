import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = p => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: root('./app.js') } },
    },
  },
  renderer: {
    root: root('.'),
    plugins: [react()],
    resolve: {
      // Renderer code imports 'electron'; with nodeIntegration on we
      // read it from window.require instead of bundling the npm package.
      alias: [
        { find: /^electron$/, replacement: root('./libs/electron-renderer.js') },
        { find: /^events$/, replacement: root('./node_modules/events/events.js') },
      ],
    },
    build: {
      rollupOptions: {
        input: {
          app: root('./app/index.html'),
          preview: root('./preview/index.html'),
          modal: root('./modal/index.html'),
          tour: root('./tour/index.html'),
        },
      },
    },
  },
});
