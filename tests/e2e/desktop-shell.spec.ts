import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const headers = { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' };

async function createList(url: string, name: string) {
  const response = await fetch(`${url}/api/lists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(201);
  const { list } = (await response.json()) as { list: { id: string } };
  return list.id;
}
async function seedToday(url: string, title: string, listId: string) {
  const created = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, target: 'today' }),
  });
  expect(created.status).toBe(201);
  const { task } = (await created.json()) as { task: { id: string } };
  const patched = await fetch(`${url}/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ listId }),
  });
  expect(patched.status).toBe(200);
}
const topBar = (page: Page) => page.getByRole('banner');
const main = (page: Page) => page.getByRole('main');

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'desktop',
    'The top bar shell is for 768px and up; the mobile tab bar is a later ticket.',
  );
});

test('desktop: at 1440px the top bar links Today, Backlog, Upcoming and History show and no sidebar exists', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);

    for (const name of ['Today', 'Backlog', 'Upcoming', 'History']) {
      await expect(
        topBar(page).getByRole('link', { name: new RegExp(`^${name}\\b`) }),
      ).toBeVisible();
    }
    await expect(page.locator('.sidebar')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('desktop: chip "A" keeps only the 2 tasks of list A on Today; selecting it again clears the filter', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const a = await createList(server.url, 'A');
    const b = await createList(server.url, 'B');
    await seedToday(server.url, 'A1', a);
    await seedToday(server.url, 'A2', a);
    await seedToday(server.url, 'B1', b);
    await page.goto(`${server.url}/today`);
    const rows = main(page).getByRole('listitem');
    const chip = main(page).getByRole('button', { name: /^A\b/ });
    await expect(rows).toHaveCount(3);

    await chip.click();

    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(2);
    await expect(main(page)).toContainText('A1');
    await expect(main(page)).toContainText('A2');
    await expect(main(page)).not.toContainText('B1');

    await chip.click();

    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(rows).toHaveCount(3);
  } finally {
    await server.stop();
  }
});

test('desktop: each nav pill link opens its route and is marked current', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);

    for (const [name, path] of [
      ['Backlog', '/backlog'],
      ['Upcoming', '/upcoming'],
      ['History', '/history'],
      ['Today', '/today'],
    ] as const) {
      const link = topBar(page).getByRole('link', {
        name: new RegExp(`^${name}\\b`),
      });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(link).toHaveAttribute('aria-current', 'page');
    }
  } finally {
    await server.stop();
  }
});

test('desktop: typing in the top-bar search and pressing Enter opens the search route with that query', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);

    const field = topBar(page).getByPlaceholder('Search');
    await field.fill('milk');
    await field.press('Enter');

    await expect(page).toHaveURL(/\/search\?(.*&)?q=milk/);
  } finally {
    await server.stop();
  }
});
