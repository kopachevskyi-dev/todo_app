import { basename } from 'node:path';
import { defineConfig } from '@playwright/test';
// Parallel worktrees must not share a port or Compose project: derive both from
// the folder name. The webServer script inherits these variables.
const folder = basename(process.cwd());
const hash = [...folder].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100_000, 7);
process.env.TEST_APP_PORT ??= String(3100 + (hash % 800));
process.env.E2E_PROJECT ??= `todo-app-test-${folder.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'main'}`;
const origin = `http://127.0.0.1:${process.env.TEST_APP_PORT}`;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: process.env.E2E_BASE_URL || origin, browserName: 'chromium',
    connectOptions: process.env.PLAYWRIGHT_WS_ENDPOINT ? { wsEndpoint: process.env.PLAYWRIGHT_WS_ENDPOINT, exposeNetwork: '<loopback>' } : undefined },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
  },
});
