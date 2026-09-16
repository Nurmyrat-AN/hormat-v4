import path from 'node:path';
import { defineConfig } from '@playwright/test';

const port = process.env.TEST_PORT ?? '3100';
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  // Separate invocations start a fresh server for each suite, preserving real login rate limits.
  projects: [{ name: 'core', testIgnore: ['**/unit/**', '**/users.spec.ts'] }, { name: 'users', testMatch: '**/users.spec.ts' }],
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: process.env.TEST_PRODUCTION === '1' ? 'npm start' : 'npm run dev',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { VENDOR_SYNC_ENABLED: 'false', MEDIA_ROOT: path.resolve('.test-media'), HOST: '127.0.0.1', PORT: port, NODE_ENV: process.env.TEST_PRODUCTION === '1' ? 'production' : 'development' },
  },
});
