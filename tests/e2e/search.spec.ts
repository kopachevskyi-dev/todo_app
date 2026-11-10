import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { startTestServer } from '../helpers/e2e-clock';

const TITLE = "Renew driver's license";

function seed(databasePath: string) {
  const db = new Database(databasePath);
  try {
    const insert = db.prepare(
      `INSERT INTO task (id, title, description, day, completed_at, placed_at, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, ?, ?, ?)`,
    );
    const at = '2026-11-04T15:00:00.000Z';
    insert.run(
      '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
      TITLE,
      '2026-11-04',
      at,
      at,
      at,
      at,
    );
    insert.run(
      '01JBX7Q3M2V8R4K9T6N0P1S5X0',
      'Buy milk',
      null,
      null,
      at,
      at,
      at,
    );
  } finally {
    db.close();
  }
}

test('desktop: typing in the sidebar search shows the result with its location; click opens it; Escape returns', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    seed(server.databasePath);
    await page.goto(`${server.url}/backlog`);

    const field = page.getByRole('navigation').getByPlaceholder('Search');
    await field.fill('license');
    await expect(page).toHaveURL(/\/search\?q=license/);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Search' })).toBeVisible();
    const row = main.getByRole('listitem').filter({ hasText: TITLE });
    await expect(row).toContainText('Done · Wed, Nov 4');
    await expect(main).not.toContainText('Buy milk');

    await row.click();
    await expect(page).toHaveURL(/[?&]task=[0-9A-Z]{26}/);
    await expect(page.getByRole('complementary')).toContainText(TITLE);

    await field.press('Escape');
    await expect(page).toHaveURL(/\/backlog/);
    await expect(field).toHaveValue('');
  } finally {
    await server.stop();
  }
});

test('mobile: Search on Backlog, typing "zzz" shows "No tasks match"', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    seed(server.databasePath);
    await page.goto(`${server.url}/backlog`);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('textbox').fill('zzz');
    await expect(page.getByText('No tasks match')).toBeVisible();
  } finally {
    await server.stop();
  }
});
