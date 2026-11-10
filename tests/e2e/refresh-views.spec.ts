import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Timezone': 'America/New_York',
};
// Clock: Tue, Nov 10, 2026 (DEFAULT_NOW from the clock helper).
const TOMORROW = '2026-11-11';

async function api(url: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response;
}
async function createTask(
  url: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const response = await api(url, 'POST', '/api/tasks', {
    title,
    target: 'backlog',
    ...extra,
  });
  return ((await response.json()) as { task: { id: string } }).task.id;
}
async function listId(url: string, name: string) {
  const response = await api(url, 'GET', '/api/lists');
  const { lists } = (await response.json()) as {
    lists: { id: string; name: string }[];
  };
  const found = lists.find((list) => list.name === name);
  if (!found) throw new Error(`Missing list ${name}`);
  return found.id;
}

const nav = (page: Page) => page.getByRole('navigation');
const main = (page: Page) => page.getByRole('main');
const rows = (page: Page) => page.locator('.task-list li');

/** The quick-add field: always on screen on desktop, inside the capture sheet on mobile. */
async function quickAddField(page: Page) {
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Add task' }).click();
  return page.getByLabel('Task title');
}
/** Desktop keeps the panel beside the list; mobile pushes the card and needs Back. */
async function closeCard(page: Page) {
  if (test.info().project.name === 'mobile')
    await page.getByRole('link', { name: /back/i }).click();
}
/** The sidebar count only exists on desktop; mobile has no count to check. */
async function expectBacklogCount(page: Page, count: string) {
  if (test.info().project.name === 'desktop')
    await expect(
      nav(page).getByRole('link', { name: /Backlog/ }),
    ).toContainText(count);
}
async function submit(page: Page, title: string) {
  const field = await quickAddField(page);
  await field.fill(title);
  await field.press('Enter');
  return field;
}

test('planning "Pay rent" for today refreshes Today, the backlog count, History and the open card without reload', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await createTask(server.url, 'Pay rent');
    await createTask(server.url, 'Other');
    await page.goto(`${server.url}/history`);
    await expect(main(page)).toContainText('Nov 9–15');
    // Open the card once so it is cached, then reach Today without a page load.
    await nav(page)
      .getByRole('link', { name: /Backlog/ })
      .click();
    await rows(page).filter({ hasText: 'Pay rent' }).click();
    await closeCard(page);
    await expectBacklogCount(page, '2');
    await nav(page).getByRole('link', { name: /Today/ }).click();

    await main(page).getByRole('button', { name: 'Add from Backlog' }).click();
    const picker = page.getByRole('dialog', { name: 'Add from Backlog' });
    await picker.getByRole('checkbox', { name: /Pay rent/ }).click();
    await picker.getByRole('button', { name: 'Add 1 to Today' }).click();
    await expect(picker).toBeHidden();

    await expect(rows(page).filter({ hasText: 'Pay rent' })).toBeVisible();
    await expectBacklogCount(page, '1');

    await rows(page).filter({ hasText: 'Pay rent' }).click();
    const card =
      test.info().project.name === 'mobile'
        ? main(page)
        : page.getByRole('complementary', { name: 'Task details' });
    await expect(card.getByRole('button', { name: /^Day/ })).toContainText(
      'Today',
    );
    await closeCard(page);

    await nav(page)
      .getByRole('link', { name: /History/ })
      .click();
    await main(page)
      .getByRole('button', { name: /^Tuesday, November 10/ })
      .click();
    await expect(
      main(page).getByRole('listitem').filter({ hasText: 'Pay rent' }),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('deleting "Pay rent" planned for Wed, Nov 11 drops the Nov 11 day load in the day picker without reload', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const rent = await createTask(server.url, 'Pay rent');
    await api(server.url, 'POST', `/api/tasks/${rent}/plan`, { day: TOMORROW });
    const other = await createTask(server.url, 'Other');
    await api(server.url, 'POST', `/api/tasks/${other}/plan`, {
      day: TOMORROW,
    });
    await page.goto(`${server.url}/history`);
    await main(page)
      .getByRole('button', { name: /^Wednesday, November 11/ })
      .click();

    // Load the day counts from the Other card.
    await rows(page).filter({ hasText: 'Other' }).click();
    await page.getByRole('button', { name: /^Day/ }).click();
    await expect(
      page.getByRole('button', { name: /Tomorrow, Wed 11/ }),
    ).toContainText('2 tasks');
    await page.keyboard.press('Escape');
    await closeCard(page);

    await rows(page).filter({ hasText: 'Pay rent' }).click();
    await page.getByRole('button', { name: /more/i }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page
      .getByRole('dialog', { name: 'Delete task' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Delete task' }),
    ).toBeHidden();
    await expect(rows(page).filter({ hasText: 'Pay rent' })).toHaveCount(0);

    await rows(page).filter({ hasText: 'Other' }).click();
    await page.getByRole('button', { name: /^Day/ }).click();
    await expect(
      page.getByRole('button', { name: /Tomorrow, Wed 11/ }),
    ).toContainText('1 task');
  } finally {
    await server.stop();
  }
});

test('renaming a subtask of a completed task refreshes History without reload', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const id = await createTask(server.url, 'Pay rent', { target: 'today' });
    await api(server.url, 'POST', `/api/tasks/${id}/subtasks`, {
      title: 'Transfer money',
    });
    await api(server.url, 'POST', `/api/tasks/${id}/complete`);
    await page.goto(`${server.url}/history`);
    await main(page)
      .getByRole('button', { name: /^Tuesday, November 10/ })
      .click();
    const row = main(page)
      .getByRole('listitem')
      .filter({ hasText: 'Pay rent' });
    await expect(row).toBeVisible();
    await row.click();

    const historyRefetch = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url().includes('/api/views/history'),
      { timeout: 5000 },
    );
    await page.getByText('Transfer money', { exact: true }).click();
    const rename = page.getByRole('textbox', { name: 'Transfer money' });
    await rename.fill('Transfer rent money');
    await rename.press('Enter');
    await expect(
      page.getByText('Transfer rent money', { exact: true }),
    ).toBeVisible();

    if (test.info().project.name === 'desktop') {
      // History stays on screen next to the card, so it must refetch now.
      await historyRefetch;
    } else {
      historyRefetch.catch(() => undefined);
      await page.getByRole('link', { name: /back/i }).click();
    }
    await expect(
      main(page).getByRole('listitem').filter({ hasText: 'Pay rent' }),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('a failed quick-add with the server stopped keeps the title, shows an error and keeps rows "A" and "B"', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await createTask(server.url, 'A');
    await createTask(server.url, 'B');
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page)).toHaveCount(2);

    await server.stop();
    const field = await submit(page, 'C');

    await expect(page.locator('.quick-add').getByRole('alert')).toBeVisible();
    await expect(field).toHaveValue('C');
    await expect(rows(page).filter({ hasText: /^A/ })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: /^B/ })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: /^C/ })).toHaveCount(0);
    await expect(page.getByText('Nothing waiting')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('while the server is slow to create, the pending row "C" cannot be opened by click or keyboard', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await createTask(server.url, 'A');
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page)).toHaveCount(1);

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'POST') await gate;
      await route.continue();
    });
    await submit(page, 'C');
    // The mobile capture sheet stays open while pending; close it to see the list.
    if (test.info().project.name === 'mobile')
      await page.keyboard.press('Escape');
    const pending = rows(page).filter({ hasText: /^C/ });
    await expect(pending).toHaveCount(1);

    await pending.dispatchEvent('click');
    await expect(page).not.toHaveURL(/task=/);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    for (let step = 0; step < 40; step++) {
      await page.keyboard.press('Tab');
      const inside = await pending.evaluate((row) =>
        row.contains(document.activeElement),
      );
      expect(inside).toBe(false);
    }

    release();
    await expect(pending).toHaveCount(1);
    await pending.click();
    await expect(page).toHaveURL(/[?&]task=[0-9A-Z]{26}/);
  } finally {
    await server.stop();
  }
});

test('a failed quick-add in the "Work" filter keeps the filtered rows and shows the error', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const work = await listId(server.url, 'Work');
    await createTask(server.url, 'A', { listId: work });
    await createTask(server.url, 'B', { listId: work });
    await createTask(server.url, 'No list');
    await page.goto(`${server.url}/backlog?lists=${work}`);
    await expect(rows(page)).toHaveCount(2);

    await server.stop();
    const field = await submit(page, 'C');

    await expect(page.locator('.quick-add').getByRole('alert')).toBeVisible();
    await expect(field).toHaveValue('C');
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByText('Nothing waiting')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});
