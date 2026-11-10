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

test('tasks left open on Mon, Nov 9 are in the Backlog with their date, missed in History, and Today offers "Review 2 unfinished"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seedMissed(page, server.url);
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await expect(
      main.getByRole('button', { name: 'Review 2 unfinished' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /Backlog/ })
      .click();
    for (const title of ['A', 'B']) {
      const row = main.getByRole('listitem').filter({ hasText: title });
      await expect(row).toContainText('from Mon, Nov 9');
    }

    await page.goto(`${server.url}/history`);
    await main.getByRole('button', { name: /^Monday, November 9/ }).click();
    await expect(main).toContainText('NOT DONE · 2');
    await expect(main.getByText('Missed')).toHaveCount(2);
  } finally {
    await server.stop();
  }
});

test('reviewing unfinished work: selecting "A" and "Add 1 to Today" plans it in its list, "B" stays in the Backlog and the entry reads "Review 1 unfinished"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seedMissed(page, server.url);
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Review 2 unfinished' }).click();

    const picker = page.getByRole('dialog', { name: 'Add from Backlog' });
    await expect(picker.getByRole('checkbox', { name: /^A/ })).toContainText(
      'was Mon, Nov 9',
    );
    await picker.getByRole('checkbox', { name: /^A/ }).click();
    await picker.getByRole('button', { name: 'Add 1 to Today' }).click();

    await expect(picker).toBeHidden();
    const rowA = main.getByRole('listitem').filter({ hasText: 'A' });
    await expect(rowA).toHaveCount(1);
    await expect(rowA).toContainText('Work');
    await expect(
      main.getByRole('listitem').filter({ hasText: 'B' }),
    ).toHaveCount(0);
    await expect(
      main.getByRole('button', { name: 'Review 1 unfinished' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /Backlog/ })
      .click();
    await expect(
      main.getByRole('listitem').filter({ hasText: 'B' }),
    ).toHaveCount(1);
  } finally {
    await server.stop();
  }
});

test('with no missed tasks in the Backlog, Today shows no review entry', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await api(server.url, 'POST', '/api/tasks', {
      title: 'Plain backlog task',
      target: 'backlog',
    });
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');
    await expect(
      main.getByRole('button', { name: 'Add from Backlog' }),
    ).toBeVisible();
    await expect(main.getByRole('button', { name: /^Review/ })).toHaveCount(0);
    await expect(main).not.toContainText('unfinished');
  } finally {
    await server.stop();
  }
});
