import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../../scripts/test-server.mjs';

const TITLE = "Renew driver's license";
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Timezone': 'America/New_York',
};

async function api(url: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as { task: { id: string } };
}
async function seed(url: string, title: string, day?: string) {
  const { task } = await api(url, 'POST', '/api/tasks', {
    title,
    target: 'backlog',
  });
  if (day) await api(url, 'POST', `/api/tasks/${task.id}/plan`, { day });
}
const setClock = (url: string) =>
  api(url, 'PUT', '/api/test/clock', { now: '2026-11-04T01:05:00.000Z' });
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test('desktop: pick Tomorrow shows "Plan for Wed, Nov 4"; Escape keeps "No day"; planning removes the task from the Backlog', async ({
  page,
}) => {
  const server = await startTestServer({ testClock: true });
  try {
    await setClock(server.url);
    for (const n of [1, 2, 3, 4])
      await seed(server.url, `Planned ${n}`, '2026-11-04');
    await seed(server.url, TITLE);
    await seed(server.url, 'Other');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}/backlog`);
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('2');
    await rows(page).filter({ hasText: TITLE }).click();
    const panel = page.getByRole('complementary');
    const day = panel.getByRole('button', { name: /^Day/ });

    await day.click();
    await expect(day).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('button', { name: /Tomorrow, Wed 4/ }),
    ).toContainText('4 tasks');
    await page.getByRole('button', { name: /Tomorrow, Wed 4/ }).click();
    await expect(
      panel.getByRole('button', { name: 'Plan for Wed, Nov 4' }),
    ).toBeVisible();

    // Escape before pressing the primary button changes nothing
    await day.click();
    await page.keyboard.press('Escape');
    await expect(day).toContainText('No day');
    await expect(
      panel.getByRole('button', { name: 'Choose a day' }),
    ).toBeVisible();

    await day.click();
    await page.getByRole('button', { name: /Tomorrow, Wed 4/ }).click();
    await panel.getByRole('button', { name: 'Plan for Wed, Nov 4' }).click();
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('1');
    await expect(day).toContainText('Wed, Nov 4');
  } finally {
    await server.stop();
  }
});

test('mobile: pick Nov 20 in the calendar, plan it, reopen and move it back to the Backlog', async ({
  page,
}) => {
  const server = await startTestServer({ testClock: true });
  try {
    await setClock(server.url);
    await seed(server.url, TITLE);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}/backlog`);
    await rows(page).first().click();

    await page.getByRole('button', { name: 'Choose a day' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Choose a day');
    await sheet.getByRole('button', { name: /Pick a date/ }).click();
    await sheet.getByRole('button', { name: /Nov(ember)? 20/ }).click();
    await page.getByRole('button', { name: 'Plan for Fri, Nov 20' }).click();

    await page.getByRole('link', { name: /back/i }).click();
    await expect(rows(page)).toHaveCount(0);
    await page.goto(`${server.url}/search?q=${encodeURIComponent(TITLE)}`);
    await rows(page).first().click();
    await expect(page.getByRole('button', { name: /^Day/ })).toContainText(
      'Fri, Nov 20',
    );
    await page.getByRole('button', { name: 'Move to backlog' }).click();
    await page.goto(`${server.url}/backlog`);
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(1);
  } finally {
    await server.stop();
  }
});
