import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100', browserName: 'chromium',
    connectOptions: process.env.PLAYWRIGHT_WS_ENDPOINT ? { wsEndpoint: process.env.PLAYWRIGHT_WS_ENDPOINT } : undefined },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
  },
});
