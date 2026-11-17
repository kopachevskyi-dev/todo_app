import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

test.use({ timezoneId: 'America/New_York' });

const headers = {
  'Content-Type': 'application/json',
  'X-Timezone': 'America/New_York',
};

async function createTask(url: string, body: Record<string, unknown>) {
  const response = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(201);
}

test('Add from Backlog lists "Unfinished from earlier" first; picking a task puts it on Today and confirms with a toast', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    // "A" and "B" are planned for Mon Nov 9 and left open; the clock then passes into Tue Nov 10.
    await setClock(page, server.url, '2026-11-09T15:00:00.000Z');
    await createTask(server.url, { title: 'A', target: 'today' });
    await createTask(server.url, { title: 'B', target: 'today' });
    await setClock(page, server.url, '2026-11-10T15:00:00.000Z');
    await createTask(server.url, { title: 'C', target: 'backlog' });
    await page.goto(`${server.url}/today`);

    await page
      .getByRole('main')
      .getByRole('button', { name: 'Add from Backlog' })
      .click();
    const picker = page.getByRole('dialog', { name: 'Add from Backlog' });
    const groups = picker.getByRole('heading', { level: 3 });
    await expect(groups.first()).toHaveText('Unfinished from earlier · 2');
    await expect(groups.last()).toHaveText('Backlog · 1');

    await picker.getByRole('checkbox', { name: /^A/ }).click();
    await picker.getByRole('button', { name: 'Add 1 to Today' }).click();

    await expect(picker).toBeHidden();
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'A' }),
    ).toHaveCount(1);
    await expect(page.getByText('Added 1 to Today')).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('desktop: clicking a row of the By list widget makes that list chip the active filter', async ({
  page,
}: {
  page: Page;
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Widgets sit in the desktop right column.',
  );
  const server = await startTestServer(page);
  try {
    const lists = (await (
      await fetch(`${server.url}/api/lists`, { headers })
    ).json()) as { lists: { id: string; name: string }[] };
    const idOf = (name: string) => lists.lists.find((l) => l.name === name)!.id;
    await createTask(server.url, {
      title: 'Work task',
      target: 'backlog',
      listId: idOf('Work'),
    });
    await createTask(server.url, {
      title: 'Home task',
      target: 'backlog',
      listId: idOf('Home'),
    });
    await page.goto(`${server.url}/backlog`);
    const main = page.getByRole('main');

    await page
      .getByRole('region', { name: 'By list' })
      .getByRole('button', { name: /^Home/ })
      .click();

    const chips = page.getByRole('group', { name: 'Filter by list' });
    await expect(chips.getByRole('button', { name: /^Home/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(chips.getByRole('button', { name: /^Work/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(main.getByText('Home task')).toBeVisible();
    await expect(main.getByText('Work task')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});
