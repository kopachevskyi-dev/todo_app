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
    const upcoming = page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name: /^Upcoming\b/ });
    if (!isMobile) await expect(upcoming).toContainText('1');
    await upcoming.click();
    await expect(page).toHaveURL(/\/upcoming$/);
    await expect(group(page, 'Tue, Nov 17')).toContainText('Dentist');

    await group(page, 'Tue, Nov 17').getByText('Dentist').click();
    await page.getByRole('button', { name: /^Day/ }).click();
    await page.getByRole('button', { name: /Tomorrow, Wed 11/ }).click();

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
    await page
      .getByRole('navigation', { name: 'Sections' })
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

const planned = async (
  url: string,
  title: string,
  day: string,
  listName?: string,
) => {
  const created = await api(url, 'POST', '/api/tasks', {
    title,
    target: 'backlog',
  });
  const { task } = (await created.json()) as { task: { id: string } };
  if (listName) {
    const lists = (await (await api(url, 'GET', '/api/lists')).json()) as {
      lists: { id: string; name: string }[];
    };
    const found = lists.lists.find((list) => list.name === listName);
    await api(url, 'PATCH', `/api/tasks/${task.id}`, { listId: found!.id });
  }
  await api(url, 'POST', `/api/tasks/${task.id}/plan`, { day });
};

test('with tasks on Tomorrow and next Monday, Upcoming groups them under "Wed, Nov 11 · 1" and "Mon, Nov 16 · 1"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await planned(server.url, 'Call plumber', '2026-11-11');
    await planned(server.url, 'Plan sprint', '2026-11-16');
    await page.goto(`${server.url}/upcoming`);

    const tomorrow = main(page).getByRole('region', {
      name: 'Wed, Nov 11 · 1',
      exact: true,
    });
    const monday = main(page).getByRole('region', {
      name: 'Mon, Nov 16 · 1',
      exact: true,
    });
    await expect(tomorrow).toContainText('Call plumber');
    await expect(monday).toContainText('Plan sprint');
  } finally {
    await server.stop();
  }
});

test('clicking Work in the By list widget makes the Work filter active and hides Home tasks', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await planned(server.url, 'Work item', '2026-11-11', 'Work');
    await planned(server.url, 'Home item', '2026-11-12', 'Home');
    await page.goto(`${server.url}/upcoming`);

    await page
      .getByRole('region', { name: 'By list' })
      .getByRole('button', { name: /^Work\b/ })
      .click();

    await expect(
      main(page)
        .getByRole('group', { name: 'Filter by list' })
        .getByRole('button', { name: /^Work\b/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(main(page)).toContainText('Work item');
    await expect(main(page)).not.toContainText('Home item');
  } finally {
    await server.stop();
  }
});
