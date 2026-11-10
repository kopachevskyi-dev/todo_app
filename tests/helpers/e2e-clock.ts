import { expect, type Page } from '@playwright/test';
import { startTestServer as startServer } from '../../scripts/test-server.mjs';

export const DEFAULT_NOW = '2026-11-10T14:00:00.000Z';

/** Keep API dates and browser dates in sync, including explicit midnight advances. */
export async function setClock(
  page: Page,
  url: string,
  now: string,
  { advance }: { advance?: number } = {},
) {
  const response = await fetch(`${url}/api/test/clock`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': 'America/New_York',
    },
    body: JSON.stringify({ now }),
  });
  expect(response.ok).toBe(true);
  if (advance === undefined) await page.clock.setSystemTime(new Date(now));
  else await page.clock.fastForward(advance);
  return response;
}

/** Every e2e server starts with both clocks controlled before seeding or navigation. */
export async function startTestServer(page: Page) {
  const server = await startServer({ testClock: true });
  try {
    await page.clock.install({ time: new Date(DEFAULT_NOW) });
    await setClock(page, server.url, DEFAULT_NOW);
    return server;
  } catch (error) {
    await server.stop();
    throw error;
  }
}
