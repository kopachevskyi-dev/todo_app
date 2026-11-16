import { test, expect } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

test('shows the Today heading in the browser with the client running', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.url);
    // The main element is rendered by React, so this also checks that JS loaded.
    await expect(
      page.getByRole('main').getByRole('heading', {
        name: 'Today',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toContainText('0 of 0 done');
    expect(errors).toEqual([]);
  } finally {
    await server.stop();
  }
});

test.describe('Today hero and Quick add', () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== 'desktop',
      'The hero and the Quick add widget are for 768px and up.',
    );
  });

  test('with 3 open tasks and no filter, the first open row is tagged "Up next" and the hero offers Open and Mark done', async ({
    page,
  }) => {
    const server = await startTestServer(page);
    try {
      for (const title of ['First', 'Second', 'Third'])
        await fetch(`${server.url}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
          body: JSON.stringify({ title, target: 'today' }),
        });
      await page.goto(`${server.url}/today`);
      const main = page.getByRole('main');
      const items = main.getByRole('listitem');
      await expect(items).toHaveCount(3);
      await expect(items.filter({ hasText: 'Up next' })).toHaveCount(1);
      await expect(items.first()).toContainText('Up next');
      await expect(main.getByRole('button', { name: 'Open' })).toBeVisible();
      await expect(
        main.getByRole('button', { name: 'Mark done' }),
      ).toBeVisible();
    } finally {
      await server.stop();
    }
  });

  test('with chip "Work" as the only filter, a title typed in Quick add and submitted creates a task for today in list Work', async ({
    page,
  }) => {
    const server = await startTestServer(page);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Timezone': 'UTC',
      };
      const lists = (await (
        await fetch(`${server.url}/api/lists`, { headers })
      ).json()) as { lists: { id: string; name: string }[] };
      const work = lists.lists.find((l) => l.name === 'Work')!.id;
      await fetch(`${server.url}/api/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'Seed', target: 'today', listId: work }),
      });
      await page.goto(`${server.url}/today`);
      const main = page.getByRole('main');
      await main.getByRole('button', { name: /^Work\b/ }).click();
      await main.getByPlaceholder('Add to today…').fill('Write report');
      await main.getByPlaceholder('Add to today…').press('Enter');

      const row = main
        .getByRole('listitem')
        .filter({ hasText: 'Write report' });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Work');
      const today = (await (
        await fetch(`${server.url}/api/views/today`, { headers })
      ).json()) as { open: { title: string; listId: string | null }[] };
      expect(today.open.find((t) => t.title === 'Write report')?.listId).toBe(
        work,
      );
    } finally {
      await server.stop();
    }
  });
});
