import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';
import { startTestServer as startProductionServer } from '../../scripts/test-server.mjs';
import {
  LICENSE,
  seedHistoryWeek,
  type Send,
} from '../helpers/history-fixture';

async function startBare(page: Page) {
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
  return { server, send };
}

async function startSeeded(page: Page) {
  const { server, send } = await startBare(page);
  const ids = await seedHistoryWeek(send);
  return { server, send, ids };
}

test('production clock powers History and the task Day label', async ({
  page,
  isMobile: mobile,
}) => {
  const server = await startProductionServer({ testClock: false });
  try {
    await page.clock.install({ time: new Date() });
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
      .getByRole('navigation', { name: 'Sections' })
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

test('desktop: Wednesday shows 4 of 5, the day summary and groups; a done task opens in the card', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, top bar or detail panel layout.',
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

async function seedThreeDoneDays(send: Send) {
  const setClock = (now: string) => send('PUT', '/api/test/clock', { now });
  const create = async (title: string) => {
    const response = await send('POST', '/api/tasks', {
      title,
      target: 'today',
    });
    return ((await response.json()) as { task: { id: string } }).task.id;
  };
  const plan: [string, string][] = [
    ['2026-11-02', 'Mon done'],
    ['2026-11-04', 'Wed done'],
    ['2026-11-06', 'Fri done'],
  ];
  for (const [day, title] of plan) {
    await setClock(`${day}T15:00:00.000Z`);
    const id = await create(title);
    if (day === '2026-11-04') await create('Wed missed');
    await setClock(`${day}T19:00:00.000Z`);
    await send('POST', `/api/tasks/${id}/complete`);
  }
  await setClock('2026-11-08T17:00:00.000Z');
}

test('done tasks on 3 days: the strip marks those days, clicking a day shows its tasks, and Week reads 3 of 4 · 75% done', async ({
  page,
}) => {
  const { server, send } = await startBare(page);
  try {
    await seedThreeDoneDays(send);
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');
    for (const name of [
      /^Monday, November 2: 1 of 1 done/,
      /^Wednesday, November 4: 1 of 2 done/,
      /^Friday, November 6: 1 of 1 done/,
    ])
      await expect(main.getByRole('button', { name })).toBeVisible();

    await main.getByRole('button', { name: /^Friday, November 6/ }).click();
    await expect(
      main.getByRole('listitem').filter({ hasText: 'Fri done' }),
    ).toBeVisible();

    const week = page.getByRole('region', { name: 'Week' });
    await expect(week).toContainText('3 of 4');
    await expect(week).toContainText('75');
    await expect(week).toContainText('% done');
  } finally {
    await server.stop();
  }
});

test('a missed row is not interactive', async ({ page }) => {
  const { server, send } = await startBare(page);
  try {
    await seedThreeDoneDays(send);
    await page.goto(`${server.url}/history`);
    const main = page.getByRole('main');
    await main.getByRole('button', { name: /^Wednesday, November 4/ }).click();
    const row = main.getByRole('listitem').filter({ hasText: 'Wed missed' });
    await expect(row).toBeVisible();
    await expect(row.getByRole('link')).toHaveCount(0);
    await expect(row.getByRole('button')).toHaveCount(0);
    await row.click();
    await expect(page).not.toHaveURL(/task=/);
  } finally {
    await server.stop();
  }
});
