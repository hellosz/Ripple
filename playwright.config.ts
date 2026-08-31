import { defineConfig } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT ?? 8010);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://ripple:ripple@localhost:5433/ripple';
const REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/0';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'pnpm --dir apps/server dev',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        APP_BASE_URL: `http://localhost:${API_PORT}`,
        DATABASE_URL,
        REDIS_URL,
        ADMIN_EMAIL: 'admin@patpat.com',
      },
    },
    {
      command: 'pnpm --dir apps/web start',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { RIPPLE_API_BASE: `http://localhost:${API_PORT}` },
    },
  ],
});
