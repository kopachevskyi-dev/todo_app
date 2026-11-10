import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const TITLE = "Renew driver's license";

async function seed(url: string, title: string) {
  const response = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
    body: JSON.stringify({ title, target: 'backlog' }),
  });
  expect(response.status).toBe(201);
}
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test('desktop: Enter saves a renamed title across reload; clearing it and blurring restores the previous title', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, TITLE);
    await page.goto(`${server.url}/backlog`);
    await rows(page).first().click();
    const panel = page.getByRole('complementary');
    const title = panel.getByRole('textbox', { name: 'Title' });

    await title.fill('Renew license');
    await title.press('Enter');
    await page.reload();
    await expect(panel.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Renew license',
    );

    await panel.getByRole('textbox', { name: 'Title' }).fill('');
    await panel.getByRole('textbox', { name: 'Title' }).blur();
    await expect(panel.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Renew license',
    );
  } finally {
    await server.stop();
  }
});

test('mobile: description and list persist; the row shows Personal and the activity shows the merged event', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, TITLE);
    await page.goto(`${server.url}/backlog`);
    await rows(page).first().click();

    await page
      .getByPlaceholder('Add a description')
      .fill('Bring the old license');
    await page.getByRole('button', { name: /^List/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Personal' })
      .click();
    await page.getByRole('link', { name: /back/i }).click();
    await expect(rows(page).first()).toContainText('Personal');

    await rows(page).first().click();
    await expect(page.getByPlaceholder('Add a description')).toHaveValue(
      'Bring the old license',
    );
    await expect(page.getByRole('button', { name: /^List/ })).toContainText(
      'Personal',
    );
    await page.getByRole('button', { name: /^Activity/ }).click();
    await expect(page.getByText('description and list added')).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('desktop: Cancel keeps the task; confirming Delete removes the row, closes the panel and drops the Backlog count', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, TITLE);
    await seed(server.url, 'Other');
    await page.goto(`${server.url}/backlog`);
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('2');
    await rows(page).filter({ hasText: TITLE }).click();
    const panel = page.getByRole('complementary');

    await panel.getByRole('button', { name: /more/i }).click();
    await panel.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(
      "Delete this task? This can't be undone.",
    );
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(1);

    await panel.getByRole('button', { name: /more/i }).click();
    await panel.getByRole('menuitem', { name: 'Delete' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(rows(page).filter({ hasText: TITLE })).toHaveCount(0);
    await expect(page).not.toHaveURL(/task=/);
    await expect(page.getByText('Select a task to add details')).toBeVisible();
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('1');
  } finally {
    await server.stop();
  }
});
