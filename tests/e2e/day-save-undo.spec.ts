import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

test.use({ timezoneId: 'America/New_York' });

const TITLE = 'Call mom';
const NOW = '2026-11-10T14:00:00.000Z'; // Tue, Nov 10, 09:00 New York
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
/** Desktop shows the card in the side panel; mobile replaces the screen. */
const card = (page: Page) =>
  test.info().project.name === 'desktop'
    ? page.getByRole('complementary')
    : page;
const dayField = (page: Page) =>
  card(page).getByRole('button', { name: /^Day/ });

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
  return (await response.json()) as { task: { id: string } };
}

async function seedToday(url: string, titles: string[]) {
  const ids: string[] = [];
  for (const title of titles)
    ids.push(
      (await api(url, 'POST', '/api/tasks', { title, target: 'today' })).task
        .id,
    );
  return ids;
}

/** Opens the card from Today; on mobile the task is a full screen. */
async function openFromToday(page: Page, url: string, id: string) {
  await page.goto(`${url}/today?task=${id}`);
  await expect(dayField(page)).toBeVisible();
}

test('choosing Tomorrow saves at once: reopened card shows Wed, Nov 11 and the task leaves Today', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const [id] = await seedToday(server.url, [TITLE]);
    await openFromToday(page, server.url, id!);

    await dayField(page).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();
    await expect(page.getByText('Moved to Wed, Nov 11')).toBeVisible();

    await page.goto(`${server.url}/today`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(0);
    await page.goto(`${server.url}/search?q=${encodeURIComponent(TITLE)}`);
    await rows(page).first().click();
    await expect(dayField(page)).toContainText('Wed, Nov 11');
  } finally {
    await server.stop();
  }
});

test('the notification reads "Moved to Wed, Nov 11" and Undo puts the task back on Today', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const [id] = await seedToday(server.url, [TITLE]);
    await openFromToday(page, server.url, id!);

    await dayField(page).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();
    await expect(page.getByText('Moved to Wed, Nov 11')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(dayField(page)).toContainText('Today');

    await page.goto(`${server.url}/today`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(1);
  } finally {
    await server.stop();
  }
});

test('calendar: browsing and closing moves nothing; Save date saves Fri, Nov 20', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const [id] = await seedToday(server.url, [TITLE]);
    await openFromToday(page, server.url, id!);

    await dayField(page).click();
    await page.getByRole('button', { name: /Pick a date/ }).click();
    await page.getByRole('button', { name: /Nov(ember)? 20/ }).click();
    await page.keyboard.press('Escape');
    await expect(dayField(page)).toContainText('Today');

    await dayField(page).click();
    await page.getByRole('button', { name: /Pick a date/ }).click();
    await page.getByRole('button', { name: /Nov(ember)? 20/ }).click();
    await page.getByRole('button', { name: 'Save date' }).click();
    await expect(dayField(page)).toContainText('Fri, Nov 20');
  } finally {
    await server.stop();
  }
});

test('a failed save returns Day to Today with an error and Retry; Retry saves Wed, Nov 11', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const [id] = await seedToday(server.url, [TITLE]);
    await openFromToday(page, server.url, id!);

    // The server is unreachable for the save request only.
    await page.route('**/api/tasks/*/plan', (route) => route.abort());
    await dayField(page).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(dayField(page)).toContainText('Today');
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();

    await page.unroute('**/api/tasks/*/plan');
    await retry.click();
    await expect(dayField(page)).toContainText('Wed, Nov 11');
  } finally {
    await server.stop();
  }
});

test('choosing Backlog moves the task to the Backlog, lowers the Today count and says "Moved to Backlog"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const [id] = await seedToday(server.url, [TITLE, 'Pay rent']);
    await openFromToday(page, server.url, id!);

    await dayField(page).click();
    await page.getByRole('button', { name: 'Keep in backlog' }).click();
    await expect(page.getByText('Moved to Backlog')).toBeVisible();

    await page.goto(`${server.url}/today`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(0);
    await expect(page.getByRole('main')).toContainText('0 of 1 done');
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(1);
  } finally {
    await server.stop();
  }
});

test('the notification is a polite live region and Undo is reachable by keyboard', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const [id] = await seedToday(server.url, [TITLE]);
    await openFromToday(page, server.url, id!);

    await dayField(page).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();
    const message = page.getByText('Moved to Wed, Nov 11');
    await expect(message).toBeVisible();
    await expect(
      page.locator('[aria-live="polite"]', { hasText: 'Moved to Wed, Nov 11' }),
    ).toHaveCount(1);

    const undo = page.getByRole('button', { name: 'Undo' });
    for (let i = 0; i < 40; i++) {
      if (await undo.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(undo).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dayField(page)).toContainText('Today');
  } finally {
    await server.stop();
  }
});
