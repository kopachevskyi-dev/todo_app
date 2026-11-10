import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';
import { startTestServer as startProductionServer } from '../../scripts/test-server.mjs';
import {
  LICENSE,
  seedHistoryWeek,
  type Send,
} from '../helpers/history-fixture';

async function startSeeded(page: Page) {
  const server = await startTestServer(page);
  const send: Send = async (method, path, body) => {
    if (path === '/api/test/clock') {
      return setClock(page, server.url, (body as { now: string }).now);
    }
    return fetch(`${server.url}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Timezone': 'America/New_York',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  const ids = await seedHistoryWeek(send);
  return { server, send, ids };
}

test('production clock powers History and the task Day label', async ({
  page,
  isMobile: mobile,
}) => {
  const server = await startProductionServer({ testClock: false });
  try {
    await page.clock.install({ time: new Date('2026-11-10T14:00:00.000Z') });
    const response = await fetch(`${server.url}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timezone': 'America/New_York',
      },
      body: JSON.stringify({ title: 'Today task', target: 'today' }),
    });
    expect(response.ok).toBe(true);
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');
    await expect(main).not.toContainText('Could not load history');
    await expect(main.getByRole('group', { name: 'Week days' })).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /Today/ })
      .click();
    await main.getByRole('listitem').filter({ hasText: 'Today task' }).click();
    const card = mobile
      ? page.getByRole('main')
      : page.getByRole('complementary', { name: 'Task details' });
    await expect(
      card.getByRole('textbox', { name: 'Title', exact: true }),
    ).toBeVisible();
    await expect(card.getByRole('button', { name: 'Day Today' })).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('desktop: Wednesday shows 4 of 5, the day summary and groups; a done task moves to the top of the Backlog', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const { server } = await startSeeded(page);
  try {
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');
    await expect(main).toContainText('Nov 2–8');
    const wed = main.getByRole('button', { name: /^Wednesday, November 4/ });
    await expect(wed).toContainText('4 of 5');

    await wed.click();
    await expect(
      main.getByRole('heading', { name: 'Wednesday, November 4' }),
    ).toBeVisible();
    await expect(main).toContainText('4 of 5 done · 1 moved to backlog');
    await expect(main).toContainText('DONE · 4');
    await expect(main).toContainText('NOT DONE · 1');

    await main.getByRole('listitem').filter({ hasText: LICENSE }).click();
    const panel = page.getByRole('complementary');
    await expect(panel).toContainText('Completed Nov 4, 2:20 PM');
    await panel.getByRole('button', { name: 'Move to backlog' }).click();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /Backlog/ })
      .click();
    await expect(main.getByRole('listitem').first()).toContainText(LICENSE);
  } finally {
    await server.stop();
  }
});

test('mobile: next week keeps Thursday selected and a future day shows PLANNED · 1', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const { server, send } = await startSeeded(page);
  try {
    const created = (await (
      await send('POST', '/api/tasks', {
        title: 'Book flights',
        target: 'backlog',
      })
    ).json()) as { task: { id: string } };
    await send('POST', `/api/tasks/${created.task.id}/plan`, {
      day: '2026-11-12',
    });
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');

    await main.getByRole('button', { name: /^Thursday, November 5/ }).click();
    await page.getByRole('button', { name: 'Next week' }).click();

    await expect(main).toContainText('Nov 9–15');
    await expect(
      main.getByRole('button', { name: /^Thursday, November 12.*selected$/ }),
    ).toBeVisible();
    await expect(main).toContainText('PLANNED · 1');
  } finally {
    await server.stop();
  }
});

test('keyboard: arrow right moves the selection to the next day and cells are labelled in full', async ({
  page,
}) => {
  const { server } = await startSeeded(page);
  try {
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');

    await main.getByRole('button', { name: /^Wednesday, November 4/ }).click();
    await expect(
      main.getByRole('button', {
        name: 'Wednesday, November 4: 4 of 5 done, selected',
        exact: true,
      }),
    ).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(
      main.getByRole('button', {
        name: 'Thursday, November 5: 3 of 4 done, selected',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main.getByRole('button', {
        name: 'Wednesday, November 4: 4 of 5 done',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});
