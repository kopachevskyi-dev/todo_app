import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

test.use({ timezoneId: 'America/New_York' });

const NOW = '2026-11-10T14:00:00.000Z'; // Tue, Nov 10, 09:00 New York
const SATURDAY = '2026-11-07T17:00:00.000Z'; // Sat, Nov 7, noon New York
const TITLE = "Renew driver's license";

const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
/** Desktop shows the card in the side panel; mobile replaces the screen. */
const card = (page: Page) =>
  test.info().project.name === 'desktop'
    ? page.getByRole('complementary')
    : page;
const dayField = (page: Page) =>
  card(page).getByRole('button', { name: /^Day/ });
const toast = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Moved to' });

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
async function seed(
  url: string,
  title: string,
  target: 'backlog' | 'today' = 'backlog',
) {
  return (await api(url, 'POST', '/api/tasks', { title, target })).task.id;
}
async function openFromBacklog(page: Page, url: string) {
  await page.goto(`${url}/backlog`);
  await rows(page).filter({ hasText: TITLE }).click();
  await expect(dayField(page)).toBeVisible();
}

test('choosing Tomorrow moves a Backlog task to Tomorrow and the toast names the destination, with no Undo', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    await seed(server.url, TITLE);
    await openFromBacklog(page, server.url);

    await dayField(page).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();

    await expect(toast(page)).toHaveText('Moved to Wed, Nov 11.');
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
    await expect(dayField(page)).toContainText('Wed, Nov 11');
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('the toast disappears after 4 seconds', async ({ page }) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    await seed(server.url, TITLE);
    await openFromBacklog(page, server.url);

    // Freeze the page clock so only fastForward moves time.
    await page.clock.pauseAt(new Date('2026-11-10T14:00:30.000Z'));
    await dayField(page).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();
    await expect(toast(page)).toBeVisible();

    await page.clock.fastForward(3500);
    await expect(toast(page)).toBeVisible();
    await page.clock.fastForward(1000);
    await expect(toast(page)).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('on a Saturday, Weekend plans the task for the following Saturday', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, SATURDAY);
    await seed(server.url, TITLE);
    await openFromBacklog(page, server.url);

    await dayField(page).click();
    await page.getByRole('button', { name: /Weekend, Sat 14/ }).click();

    await expect(toast(page)).toHaveText('Moved to Sat, Nov 14.');
    await expect(dayField(page)).toContainText('Sat, Nov 14');
  } finally {
    await server.stop();
  }
});

test('options show the day load: "2 tasks" for a day with two, "Free" for an empty day', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    for (const title of ['Planned 1', 'Planned 2']) {
      const id = await seed(server.url, title);
      await api(server.url, 'POST', `/api/tasks/${id}/plan`, {
        day: '2026-11-11',
      });
    }
    await seed(server.url, TITLE);
    await openFromBacklog(page, server.url);

    await dayField(page).click();
    await expect(
      page.getByRole('button', { name: /Tomorrow, Wed 11/ }),
    ).toContainText('2 tasks');
    await expect(
      page.getByRole('button', { name: /Weekend, Sat 14/ }),
    ).toContainText('Free');
  } finally {
    await server.stop();
  }
});

test('Move to Backlog sends an open task to the Backlog and says "Moved to Backlog."', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    const id = await seed(server.url, TITLE, 'today');
    await page.goto(`${server.url}/today?task=${id}`);
    await expect(dayField(page)).toBeVisible();

    await dayField(page).click();
    await page.getByRole('button', { name: 'Move to Backlog' }).click();

    await expect(toast(page)).toHaveText('Moved to Backlog.');
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(1);
  } finally {
    await server.stop();
  }
});

test('the picker has no calendar and no "Save date" button', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, NOW);
    await seed(server.url, TITLE);
    await openFromBacklog(page, server.url);

    await dayField(page).click();
    await expect(
      page.getByRole('button', { name: 'Move to Backlog' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Pick a date/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: 'Save date' })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: /Nov(ember)? 20/ }),
    ).toHaveCount(0);
  } finally {
    await server.stop();
  }
});
