import { test, expect, type Page } from '@playwright/test';
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
  return response.json() as Promise<{ task: { id: string } }>;
}

/** "A" (Work) and "B" planned for Mon Nov 9 and left open; the clock then passes into Tue Nov 10. */
async function seedMissed(page: Page, url: string) {
  await setClock(page, url, '2026-11-09T15:00:00.000Z');
  const lists = (await (
    await fetch(`${url}/api/lists`, {
      headers: { 'X-Timezone': 'America/New_York' },
    })
  ).json()) as { lists: { id: string; name: string }[] };
  const work = lists.lists.find((l) => l.name === 'Work')!.id;
  await api(url, 'POST', '/api/tasks', {
    title: 'A',
    target: 'today',
    listId: work,
  });
  await api(url, 'POST', '/api/tasks', { title: 'B', target: 'today' });
  await setClock(page, url, '2026-11-10T15:00:00.000Z');
}

test('tasks left open on Mon, Nov 9 are in the Backlog with their date, missed in History', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seedMissed(page, server.url);
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');

    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name: /Backlog/ })
      .click();
    for (const title of ['A', 'B']) {
      const row = main.getByRole('listitem').filter({ hasText: title });
      await expect(row).toContainText('was Nov 9');
    }

    await page.goto(`${server.url}/history`);
    await main.getByRole('button', { name: /^Monday, November 9/ }).click();
    await expect(main).toContainText('NOT DONE · 2');
    await expect(main.getByText('Missed')).toHaveCount(2);
  } finally {
    await server.stop();
  }
});

test('desktop: 2 unfinished tasks returned from yesterday show in the Unfinished widget; "Add 2 to today" puts both in Today and the widget shows none returned', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Widgets sit in the desktop right column.',
  );
  const server = await startTestServer(page);
  try {
    await seedMissed(page, server.url);
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await expect(main).toContainText('2 returned');
    await main.getByRole('button', { name: 'Add 2 to today' }).click();

    for (const title of ['A', 'B']) {
      await expect(
        main.getByRole('listitem').filter({ hasText: title }),
      ).toHaveCount(1);
    }
    await expect(main).not.toContainText('returned');
    await expect(
      main.getByRole('button', { name: /^Add \d+ to today/ }),
    ).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('no "Review N unfinished" button exists on Today, with or without returned tasks', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seedMissed(page, server.url);
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: /^Review/ })).toHaveCount(0);
    await page.goto(`${server.url}/backlog`);
    await expect(main.getByRole('button', { name: /^Review/ })).toHaveCount(0);
    await page.goto(`${server.url}/upcoming`);
    await expect(main.getByRole('button', { name: /^Review/ })).toHaveCount(0);
    await page.goto(`${server.url}/history`);
    await expect(main.getByRole('button', { name: /^Review/ })).toHaveCount(0);
  } finally {
    await server.stop();
  }
});
