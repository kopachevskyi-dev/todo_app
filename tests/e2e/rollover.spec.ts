import { test, expect } from '@playwright/test';
import { startTestServer } from '../../scripts/test-server.mjs';

test.use({ timezoneId: 'America/New_York' });

async function api(url: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': 'America/New_York',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
}
const setClock = (url: string, now: string) =>
  api(url, 'PUT', '/api/test/clock', { now });

test('desktop: the open app rolls a task to the Backlog at midnight without a reload', async ({
  page,
}) => {
  const server = await startTestServer({ testClock: true });
  try {
    await setClock(server.url, '2026-11-04T15:00:00.000Z');
    await api(server.url, 'POST', '/api/tasks', {
      title: 'Pay rent',
      target: 'today',
    });
    // Wed Nov 4, 11:59:50 PM in New York.
    await setClock(server.url, '2026-11-05T04:59:50.000Z');
    await page.clock.install({ time: new Date('2026-11-05T04:59:50.000Z') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await expect(main).toContainText('Wednesday, November 4');
    await expect(main).toContainText('Pay rent');

    await setClock(server.url, '2026-11-05T05:00:05.000Z');
    await page.clock.fastForward(15_000);

    await expect(main).toContainText('Thursday, November 5');
    await expect(main).toContainText('Nothing planned for today');
    await expect(main).not.toContainText('Pay rent');

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /Backlog/ })
      .click();
    const first = main.getByRole('listitem').first();
    await expect(first).toContainText('Pay rent');
    await expect(first).toContainText('from Wed, Nov 4');
  } finally {
    await server.stop();
  }
});
