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

test('desktop: From backlog → select 2 → "Plan for today (2)" moves them into Today and updates the counts', async ({
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

    await main.getByRole('button', { name: 'From backlog' }).click();
    const picker = page.getByRole('dialog', { name: 'From backlog' });
    await picker.getByRole('checkbox', { name: /Backlog A/ }).click();
    await picker.getByRole('checkbox', { name: /Backlog B/ }).click();
    await picker.getByRole('button', { name: 'Plan for today (2)' }).click();

    await expect(picker).toBeHidden();
    await expect(rows(page).filter({ hasText: 'Backlog A' })).toBeVisible();
    await expect(rows(page).filter({ hasText: 'Backlog B' })).toBeVisible();
    await expect(main).toContainText('0 of 4 done');
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('1');
  } finally {
    await server.stop();
  }
});

test('mobile: From backlog opens a sheet; nothing selected disables the button; Escape and scrim close it without change', async ({
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
      main.getByRole('button', { name: 'From backlog' }).click();
    const sheet = page.getByRole('dialog', { name: 'From backlog' });

    await open();
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole('button', { name: /^Plan for today/ }),
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
