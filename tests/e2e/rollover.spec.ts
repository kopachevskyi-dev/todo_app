import { test, expect } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

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

test('the open app rolls a task to the Backlog at midnight without a reload', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, '2026-11-04T15:00:00.000Z');
    await api(server.url, 'POST', '/api/tasks', {
      title: 'Pay rent',
      target: 'today',
    });
    // Wed Nov 4, 11:59:50 PM in New York.
    await setClock(page, server.url, '2026-11-05T04:59:50.000Z');
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await expect(main).toContainText('Wednesday, November 4');
    await expect(main).toContainText('Pay rent');

    await setClock(page, server.url, '2026-11-05T05:00:05.000Z', {
      advance: 15_000,
    });

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
