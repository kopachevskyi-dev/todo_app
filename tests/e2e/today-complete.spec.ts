import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

test.use({ timezoneId: 'America/New_York' });

const LICENSE = "Renew driver's license";
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
  return (await response.json()) as { task: { id: string } };
}

/** Wed Nov 4: 5 tasks today, "Pay rent" completed at 10:00 AM, clock left at 2:20 PM. */
async function seedToday(page: Page, url: string) {
  await setClock(page, url, '2026-11-04T14:00:00.000Z');
  for (const title of [LICENSE, 'Call the dentist', 'Buy milk', 'Water plants'])
    await api(url, 'POST', '/api/tasks', { title, target: 'today' });
  const rent = await api(url, 'POST', '/api/tasks', {
    title: 'Pay rent',
    target: 'today',
  });
  await setClock(page, url, '2026-11-04T15:00:00.000Z');
  await api(url, 'POST', `/api/tasks/${rent.task.id}/complete`);
  await setClock(page, url, '2026-11-04T19:20:00.000Z');
}

test('desktop: checking a task moves it under Completed with its time, updates progress, nav badge and detail; Reopen restores it', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seedToday(page, server.url);
    await page.goto(server.url);
    const main = page.getByRole('main');
    await expect(main).toContainText('1 of 5 done');

    await page.getByRole('checkbox', { name: LICENSE }).check();
    await expect(
      main.getByRole('heading', { name: 'Completed' }),
    ).toBeVisible();
    await expect(
      rows(page).filter({ hasText: LICENSE }).getByRole('checkbox'),
    ).toBeChecked();
    await expect(
      rows(page).filter({ hasText: 'Pay rent' }).getByRole('checkbox'),
    ).toBeChecked();
    await expect(rows(page).filter({ hasText: LICENSE })).toContainText(
      '2:20 PM',
    );
    await expect(main).toContainText('2 of 5 done');
    await expect(
      page.getByRole('navigation').getByRole('link', { name: /Today/ }),
    ).toContainText('3');

    await rows(page).filter({ hasText: LICENSE }).click();
    const panel = page.getByRole('complementary');
    await expect(panel).toContainText('Completed at 2:20 PM');
    await panel.getByRole('button', { name: 'Reopen' }).click();

    await expect(main).toContainText('1 of 5 done');
    await expect(
      main.getByRole('heading', { name: 'Completed' }),
    ).toBeVisible();
    await expect(
      rows(page).filter({ hasText: LICENSE }).getByRole('checkbox'),
    ).not.toBeChecked();
    await expect(
      rows(page).filter({ hasText: 'Pay rent' }).getByRole('checkbox'),
    ).toBeChecked();
    await expect(rows(page).filter({ hasText: LICENSE })).not.toContainText(
      '2:20 PM',
    );
  } finally {
    await server.stop();
  }
});

test('mobile: the + button adds "Buy stamps" as the first open row and the total becomes 6', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    await seedToday(page, server.url);
    await page.goto(server.url);
    await expect(page.getByRole('main')).toContainText('1 of 5 done');

    await page.getByRole('button', { name: 'Add task to today' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('textbox').fill('Buy stamps');
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(rows(page).first()).toContainText('Buy stamps');
    await expect(page.getByRole('main')).toContainText('1 of 6 done');
  } finally {
    await server.stop();
  }
});

test('an empty day shows the empty state', async ({ page }) => {
  const server = await startTestServer(page);
  try {
    await setClock(page, server.url, '2026-11-04T19:20:00.000Z');
    await page.goto(server.url);
    await expect(
      page.getByText(
        'Nothing planned for today. Add a task or pull one from the backlog.',
      ),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});
