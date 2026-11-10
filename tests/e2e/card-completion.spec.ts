import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';
import { seedHistoryWeek, type Send } from '../helpers/history-fixture';

test.use({ timezoneId: 'America/New_York' });

const TITLE = 'Call mom';
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
/** Desktop shows the card in the side panel; mobile replaces the screen. */
const card = (page: Page) =>
  test.info().project.name === 'desktop'
    ? page.getByRole('complementary')
    : page;

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

test('completing and reopening from the open card keeps it open and moves the row and progress', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const [id] = await seedToday(server.url, [TITLE]);
    await page.goto(`${server.url}/today?task=${id}`);
    const main = page.getByRole('main');
    if (test.info().project.name === 'mobile')
      await page.getByRole('link', { name: 'Back to Today' }).click();
    await expect(main).toContainText('0 of 1 done');
    if (test.info().project.name === 'mobile')
      await rows(page).filter({ hasText: TITLE }).getByRole('link').click();

    await card(page)
      .getByRole('checkbox', { name: `Complete "${TITLE}"` })
      .check();
    await expect(
      card(page).getByRole('checkbox', { name: `Reopen "${TITLE}"` }),
    ).toBeChecked();
    await expect(page).toHaveURL(/task=/);
    if (test.info().project.name === 'mobile')
      await page.getByRole('link', { name: 'Back to Today' }).click();
    await expect(main).toContainText('1 of 1 done');
    const completed = main.getByRole('heading', { name: 'Completed' });
    await expect(completed).toBeVisible();
    const headingY = (await completed.boundingBox())!.y;
    const rowY = (await rows(page).filter({ hasText: TITLE }).boundingBox())!.y;
    expect(rowY).toBeGreaterThan(headingY);

    if (test.info().project.name === 'mobile')
      await rows(page).filter({ hasText: TITLE }).getByRole('link').click();
    await card(page)
      .getByRole('checkbox', { name: `Reopen "${TITLE}"` })
      .uncheck();
    await expect(
      card(page).getByRole('checkbox', { name: `Complete "${TITLE}"` }),
    ).not.toBeChecked();
    await expect(page).toHaveURL(/task=/);
    if (test.info().project.name === 'mobile')
      await page.getByRole('link', { name: 'Back to Today' }).click();
    await expect(main).toContainText('0 of 1 done');
    await expect(main.getByRole('heading', { name: 'Completed' })).toHaveCount(
      0,
    );
  } finally {
    await server.stop();
  }
});

test('checking both subtasks leaves the parent open and the row shows 2/2', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const [id] = await seedToday(server.url, [TITLE]);
    for (const title of ['Dial', 'Talk'])
      await api(server.url, 'POST', `/api/tasks/${id}/subtasks`, { title });
    await page.goto(`${server.url}/today?task=${id}`);

    await card(page).getByRole('checkbox', { name: /Dial/ }).check();
    await card(page).getByRole('checkbox', { name: /Talk/ }).check();

    await expect(
      card(page).getByRole('checkbox', { name: `Complete "${TITLE}"` }),
    ).not.toBeChecked();
    if (test.info().project.name === 'mobile')
      await page.getByRole('link', { name: 'Back to Today' }).click();
    await expect(rows(page).filter({ hasText: TITLE })).toContainText('2/2');
    await expect(page.getByRole('main')).toContainText('0 of 1 done');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Completed' }),
    ).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('Tab moves from the row checkbox to the row link; Space completes without opening; Enter on the link opens the card', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seedToday(server.url, [TITLE, 'Buy milk']);
    await page.goto(`${server.url}/today`);
    const row = rows(page).filter({ hasText: TITLE });
    const checkbox = row.getByRole('checkbox', {
      name: `Complete "${TITLE}"`,
    });
    const link = row.getByRole('link', { name: new RegExp(TITLE) });

    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(checkbox).not.toBeFocused();

    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(
      rows(page)
        .filter({ hasText: TITLE })
        .getByRole('checkbox', { name: `Reopen "${TITLE}"` }),
    ).toBeChecked();
    await expect(page).not.toHaveURL(/task=/);

    await rows(page)
      .filter({ hasText: TITLE })
      .getByRole('link', { name: new RegExp(TITLE) })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/task=/);
    await expect(
      card(page).getByRole('checkbox', { name: `Reopen "${TITLE}"` }),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('Delete from the card menu removes the task after confirming; cancelling keeps it', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const [id] = await seedToday(server.url, [TITLE]);
    await page.goto(`${server.url}/today?task=${id}`);
    const openDelete = async () => {
      await card(page).getByRole('button', { name: /more/i }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
    };

    await openDelete();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    if (test.info().project.name === 'mobile')
      await page.getByRole('link', { name: 'Back to Today' }).click();
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(1);
    if (test.info().project.name === 'mobile')
      await rows(page).filter({ hasText: TITLE }).getByRole('link').click();

    await openDelete();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('Activity is collapsed as "Activity (3)" on an open task and expanded on a completed one', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const [id] = await seedToday(server.url, [TITLE]); // 1: added to today
    await api(server.url, 'PATCH', `/api/tasks/${id}`, {
      description: 'Ask about Sunday',
    }); // 2: description added
    await setClock(page, server.url, '2026-11-10T16:00:00.000Z');
    await api(server.url, 'POST', `/api/tasks/${id}/subtasks`, {
      title: 'Dial',
    }); // 3: subtasks added (outside the 15-minute merge window)
    await page.goto(`${server.url}/today?task=${id}`);

    const toggle = card(page).getByRole('button', { name: 'Activity (3)' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(card(page).locator('.activity li')).toHaveCount(0);

    await card(page)
      .getByRole('checkbox', { name: `Complete "${TITLE}"` })
      .check();
    await expect(
      card(page).getByRole('checkbox', { name: `Reopen "${TITLE}"` }),
    ).toBeChecked();
    await page.reload();
    await expect(
      card(page).getByRole('button', { name: /^Activity/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(card(page).locator('.activity li')).toHaveCount(4);
  } finally {
    await server.stop();
  }
});

test('a missed task in History shows a non-focusable "Missed" marker without a checkbox', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const send: Send = async (method, path, body) => {
      if (path === '/api/test/clock')
        return setClock(page, server.url, (body as { now: string }).now);
      return fetch(`${server.url}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Timezone': 'America/New_York',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    };
    await seedHistoryWeek(send);
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: /^Wednesday, November 4/ }).click();

    const row = main
      .getByRole('listitem')
      .filter({ hasText: 'Call the dentist' });
    const marker = row.getByText('Missed', { exact: true });
    await expect(marker).toBeVisible();
    await expect(row.getByRole('checkbox')).toHaveCount(0);
    expect(
      await marker.evaluate(
        (el) =>
          el.matches('a, button, input, [tabindex]') ||
          el.closest('a, button, [tabindex]') !== null,
      ),
    ).toBe(false);
  } finally {
    await server.stop();
  }
});

test('Today lists 2 open rows, then a Completed heading, then the completed row', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const [, , done] = await seedToday(server.url, [
      'Buy milk',
      'Water plants',
      'Pay rent',
    ]);
    await api(server.url, 'POST', `/api/tasks/${done}/complete`);
    await page.goto(`${server.url}/today`);
    const main = page.getByRole('main');

    await expect(main).toContainText('1 of 3 done');
    const heading = main.getByRole('heading', { name: 'Completed' });
    await expect(heading).toBeVisible();
    const headingY = (await heading.boundingBox())!.y;
    for (const title of ['Buy milk', 'Water plants']) {
      const y = (await rows(page).filter({ hasText: title }).boundingBox())!.y;
      expect(y).toBeLessThan(headingY);
    }
    const doneY = (await rows(page)
      .filter({ hasText: 'Pay rent' })
      .boundingBox())!.y;
    expect(doneY).toBeGreaterThan(headingY);
  } finally {
    await server.stop();
  }
});
