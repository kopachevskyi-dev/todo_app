import { test, expect, type Page } from '@playwright/test';
import { startTestServer, setClock } from '../helpers/e2e-clock';

test.use({ timezoneId: 'America/New_York' });

const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
const titles = async (page: Page) =>
  (await rows(page).allTextContents()).map((text) => text.trim()[0]);

test('desktop: Move up used twice on "C" with the keyboard orders Today C, A, B and keeps it after reload', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard layout.',
  );
  const server = await startTestServer(page);
  try {
    // Newest-first: creating C, B, A shows A, B, C.
    for (const [i, title] of ['C', 'B', 'A'].entries()) {
      await setClock(page, server.url, `2026-11-10T14:0${i}:00.000Z`);
      const response = await fetch(`${server.url}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timezone': 'America/New_York',
        },
        body: JSON.stringify({ title, target: 'today' }),
      });
      expect(response.ok).toBe(true);
    }
    await page.goto(server.url);
    await expect.poll(() => titles(page)).toEqual(['A', 'B', 'C']);

    for (let i = 0; i < 2; i++) {
      const moveUp = rows(page)
        .filter({ hasText: 'C' })
        .getByRole('button', { name: 'Move up' });
      await moveUp.focus();
      await page.keyboard.press('Enter');
    }
    await expect.poll(() => titles(page)).toEqual(['C', 'A', 'B']);

    await page.reload();
    await expect.poll(() => titles(page)).toEqual(['C', 'A', 'B']);
  } finally {
    await server.stop();
  }
});
