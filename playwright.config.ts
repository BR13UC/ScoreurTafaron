import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry', channel: process.platform === 'win32' ? 'msedge' : undefined },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:3000/api/health', reuseExistingServer: true },
});
