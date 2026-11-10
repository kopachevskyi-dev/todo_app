import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

test.use({ timezoneId: 'America/New_York' });

const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

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
/** Wed Nov 4: 2 tasks today, 3 in the backlog. */
async function seed(page: Page, url: string) {
  await setClock(page, url, '2026-11-04T19:20:00.000Z');
  for (const title of ['Today one', 'Today two'])
    await api(url, 'POST', '/api/tasks', { title, target: 'today' });
  for (const title of ['Backlog A', 'Backlog B', 'Backlog C'])
    await api(url, 'POST', '/api/tasks', { title, target: 'backlog' });
}

test('desktop: Add from Backlog → select 2 → "Add 2 to Today" moves them into Today and updates the counts', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(page, server.url);
    await page.goto(server.url);
    const main = page.getByRole('main');
    const nav = page.getByRole('navigation');
    await expect(main).toContainText('0 of 2 done');
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('3');

    await main.getByRole('button', { name: 'Add from Backlog' }).click();
    const picker = page.getByRole('dialog', { name: 'Add from Backlog' });
    await picker.getByRole('checkbox', { name: /Backlog A/ }).click();
    await picker.getByRole('checkbox', { name: /Backlog B/ }).click();
    await picker.getByRole('button', { name: 'Add 2 to Today' }).click();

    await expect(picker).toBeHidden();
    await expect(rows(page).filter({ hasText: 'Backlog A' })).toBeVisible();
    await expect(rows(page).filter({ hasText: 'Backlog B' })).toBeVisible();
    await expect(main).toContainText('0 of 4 done');
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('1');
  } finally {
    await server.stop();
  }
});

test('mobile: Add from Backlog opens a sheet; nothing selected disables the button; Escape and scrim close it without change', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(page, server.url);
    await page.goto(server.url);
    const main = page.getByRole('main');
    const open = () =>
      main.getByRole('button', { name: 'Add from Backlog' }).click();
    const sheet = page.getByRole('dialog', { name: 'Add from Backlog' });

    await open();
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole('button', { name: /^Add \d+ to Today/ }),
    ).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    await open();
    await expect(sheet).toBeVisible();
    await page.mouse.click(195, 20); // scrim, above the sheet
    await expect(sheet).toBeHidden();
    await expect(main).toContainText('0 of 2 done');
    await expect(rows(page).filter({ hasText: 'Backlog A' })).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

async function task(url: string, title: string, extra = {}) {
  const response = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': 'America/New_York',
    },
    body: JSON.stringify({ title, target: 'backlog', ...extra }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { task: { id: string } }).task.id;
}
const openPicker = async (page: Page) => {
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Add from Backlog' })
    .click();
  return page.getByRole('dialog', { name: 'Add from Backlog' });
};
const todayRows = (page: Page, title: string) =>
  rows(page).filter({ hasText: title });

test('Add 2 to Today closes the picker, shows both tasks in Today and confirms "Added 2 to Today"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await task(server.url, 'A');
    await task(server.url, 'B');
    await page.goto(server.url);
    const picker = await openPicker(page);
    await picker.getByRole('checkbox', { name: /^A/ }).click();
    await picker.getByRole('checkbox', { name: /^B/ }).click();
    await picker.getByRole('button', { name: 'Add 2 to Today' }).click();

    await expect(picker).toBeHidden();
    await expect(todayRows(page, 'A')).toHaveCount(1);
    await expect(todayRows(page, 'B')).toHaveCount(1);
    await expect(page.getByText('Added 2 to Today')).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('when "B" was planned for tomorrow meanwhile, the picker stays open without "B", keeps "A" selected and Add 1 to Today plans "A" once', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await task(server.url, 'A');
    const b = await task(server.url, 'B');
    await page.goto(server.url);
    const picker = await openPicker(page);
    await picker.getByRole('checkbox', { name: /^A/ }).click();
    await picker.getByRole('checkbox', { name: /^B/ }).click();
    await fetch(`${server.url}/api/tasks/${b}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timezone': 'America/New_York',
      },
      body: JSON.stringify({ day: '2026-11-11' }),
    });
    await picker.getByRole('button', { name: 'Add 2 to Today' }).click();

    await expect(picker).toBeVisible();
    await expect(
      picker.getByText(
        '1 task was already planned elsewhere. Add the remaining 1?',
      ),
    ).toBeVisible();
    await expect(picker.getByRole('checkbox', { name: /^B/ })).toHaveCount(0);
    await expect(picker.getByRole('checkbox', { name: /^A/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await picker.getByRole('button', { name: 'Add 1 to Today' }).click();

    await expect(picker).toBeHidden();
    await expect(todayRows(page, 'A')).toHaveCount(1);
    await expect(todayRows(page, 'B')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('when the server is unreachable, the picker stays open with both selected and the error; a retry plans each task once', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await task(server.url, 'A');
    await task(server.url, 'B');
    await page.goto(server.url);
    const picker = await openPicker(page);
    await picker.getByRole('checkbox', { name: /^A/ }).click();
    await picker.getByRole('checkbox', { name: /^B/ }).click();

    // The browser loses the server: abort the request, as a stopped server would.
    await page.route('**/api/tasks/plan-today', (route) => route.abort());
    await picker.getByRole('button', { name: 'Add 2 to Today' }).click();

    await expect(picker).toBeVisible();
    await expect(
      picker.getByText("Couldn't add tasks. Try again."),
    ).toBeVisible();
    await expect(picker.getByRole('checkbox', { name: /^A/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(picker.getByRole('checkbox', { name: /^B/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.unroute('**/api/tasks/plan-today');
    await picker.getByRole('button', { name: 'Add 2 to Today' }).click();
    await expect(picker).toBeHidden();
    await expect(todayRows(page, 'A')).toHaveCount(1);
    await expect(todayRows(page, 'B')).toHaveCount(1);
  } finally {
    await server.stop();
  }
});

test('with Today filtered to Work, the picker shows All lists and offers backlog tasks of every list', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const lists = (await (
      await fetch(`${server.url}/api/lists`, {
        headers: { 'X-Timezone': 'America/New_York' },
      })
    ).json()) as { lists: { id: string; name: string }[] };
    const idOf = (name: string) => lists.lists.find((l) => l.name === name)!.id;
    await task(server.url, 'Work task', { listId: idOf('Work') });
    await task(server.url, 'Home task', { listId: idOf('Home') });
    await page.goto(server.url);
    if (test.info().project.name === 'mobile')
      await page.getByRole('button', { name: 'Work', exact: true }).click();
    else await page.getByRole('button', { name: /^Work$/ }).click();

    const picker = await openPicker(page);
    await expect(picker.getByText('All lists')).toBeVisible();
    await expect(
      picker.getByRole('checkbox', { name: /Work task/ }),
    ).toHaveCount(1);
    await expect(
      picker.getByRole('checkbox', { name: /Home task/ }),
    ).toHaveCount(1);
  } finally {
    await server.stop();
  }
});
