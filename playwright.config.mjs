import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.mjs',
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
});
