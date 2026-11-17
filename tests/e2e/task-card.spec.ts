import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const TITLE = 'Call mom';

async function seed(url: string) {
  const response = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
    body: JSON.stringify({ title: TITLE, target: 'today' }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { task: { id: string } }).task.id;
}

async function complete(url: string, id: string) {
  const response = await fetch(`${url}/api/tasks/${id}/complete`, {
    method: 'POST',
    headers: { 'X-Timezone': 'UTC' },
  });
  expect(response.ok).toBe(true);
}

const card = (page: Page) =>
  test.info().project.name === 'desktop'
    ? page.getByRole('complementary')
    : page;

test.describe('desktop 1440px', () => {
  test.skip(
    () => test.info().project.name !== 'desktop',
    'Exercises the 1440px layout.',
  );

  test('an opened task shows in the right column', async ({ page }) => {
    const server = await startTestServer(page);
    try {
      const id = await seed(server.url);
      await page.goto(`${server.url}/today?task=${id}`);
      const column = page.getByRole('complementary');
      await expect(column.getByRole('textbox', { name: 'Title' })).toHaveValue(
        TITLE,
      );
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const main = await page.getByRole('main').boundingBox();
      const side = await column.boundingBox();
      expect(side!.x).toBeGreaterThanOrEqual(main!.x + main!.width - 1);
    } finally {
      await server.stop();
    }
  });
});

test.describe('tablet 900px', () => {
  test.use({ viewport: { width: 900, height: 900 } });
  test.skip(
    () => test.info().project.name !== 'desktop',
    'Overrides the desktop project viewport.',
  );

  test('an opened task shows as a drawer', async ({ page }) => {
    const server = await startTestServer(page);
    try {
      const id = await seed(server.url);
      await page.goto(`${server.url}/today?task=${id}`);
      const drawer = page.getByRole('dialog', { name: 'Task details' });
      await expect(drawer.getByRole('textbox', { name: 'Title' })).toHaveValue(
        TITLE,
      );
      await expect(page.getByRole('complementary')).toHaveCount(0);
    } finally {
      await server.stop();
    }
  });
});

test.describe('mobile', () => {
  test.skip(
    () => test.info().project.name !== 'mobile',
    'Exercises the mobile layout.',
  );

  test('an opened task shows as a full screen', async ({ page }) => {
    const server = await startTestServer(page);
    try {
      const id = await seed(server.url);
      await page.goto(`${server.url}/today?task=${id}`);
      await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(
        TITLE,
      );
      await expect(
        page.getByRole('link', { name: 'Back to Today' }),
      ).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const box = await page.getByRole('main').boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(388);
      expect(box!.height).toBeGreaterThanOrEqual(840);
    } finally {
      await server.stop();
    }
  });
});

for (const completed of [false, true]) {
  test(`the ${completed ? 'done' : 'open'} card has a Delete task button and no Reopen, Move to backlog or More button`, async ({
    page,
  }) => {
    const server = await startTestServer(page);
    try {
      const id = await seed(server.url);
      if (completed) await complete(server.url, id);
      await page.goto(`${server.url}/today?task=${id}`);
      await expect(
        card(page).getByRole('button', { name: 'Delete task' }),
      ).toBeVisible();
      for (const name of [/reopen/i, /move to backlog/i, /more/i])
        await expect(card(page).getByRole('button', { name })).toHaveCount(0);
    } finally {
      await server.stop();
    }
  });
}
