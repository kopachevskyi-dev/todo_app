import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Timezone': 'America/New_York',
};
// Clock: Tue, Nov 10, 2026 (DEFAULT_NOW from the clock helper).

async function api(url: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response;
}

const main = (page: Page) => page.getByRole('main');
/** A date group of the agenda, named by its heading. */
const group = (page: Page, heading: string) =>
  main(page).getByRole('region', { name: heading });

test('opening Upcoming from Today lists "Dentist" under Tue, Nov 17; changing its day to Tomorrow moves it under Wed, Nov 11 without reload', async ({
  page,
  isMobile,
}) => {
  const server = await startTestServer(page);
  try {
    const created = await api(server.url, 'POST', '/api/tasks', {
      title: 'Dentist',
      target: 'backlog',
    });
    const { task } = (await created.json()) as { task: { id: string } };
    await api(server.url, 'POST', `/api/tasks/${task.id}/plan`, {
      day: '2026-11-17',
    });

    await page.goto(`${server.url}/today`);
    await main(page)
      .getByRole('link', { name: /^Upcoming · 1$/ })
      .click();
    await expect(page).toHaveURL(/\/upcoming$/);
    await expect(group(page, 'Tue, Nov 17')).toContainText('Dentist');

    await group(page, 'Tue, Nov 17').getByText('Dentist').click();
    await page.getByRole('button', { name: /^Day/ }).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();
    await page.getByRole('button', { name: 'Plan for Wed, Nov 11' }).click();

    if (isMobile)
      await page.getByRole('link', { name: 'Back to Upcoming' }).click();

    await expect(group(page, 'Wed, Nov 11')).toContainText('Dentist');
    await expect(group(page, 'Tue, Nov 17')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('with no future tasks, Upcoming reads "Nothing planned ahead" with "Plan from Backlog"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    await main(page)
      .getByRole('link', { name: /^Upcoming$/ })
      .click();
    await expect(main(page)).toContainText('Nothing planned ahead');
    await expect(
      main(page).getByRole('link', { name: 'Plan from Backlog' }),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});
