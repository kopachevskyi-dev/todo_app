import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    // Ticket clock scenarios use New York dates, independent of the host timezone.
    timezoneId: 'America/New_York',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
