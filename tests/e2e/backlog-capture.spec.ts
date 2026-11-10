import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const TITLE = "Renew driver's license";

async function seed(url: string, titles: string[]) {
  for (const title of titles) {
    const response = await fetch(`${url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
      body: JSON.stringify({ title, target: 'backlog' }),
    });
    expect(response.status).toBe(201);
  }
}
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test('desktop: Enter adds the task as the first row, clears and focuses the field, and bumps both counts', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, ['One', 'Two']);
    await page.goto(`${server.url}/backlog`);
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('2');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Backlog' }),
    ).toBeVisible();

    const field = page.getByPlaceholder('Add to backlog');
    await field.fill(TITLE);
    await field.press('Enter');

    await expect(rows(page).first()).toContainText(TITLE);
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await expect(nav.getByRole('link', { name: /Backlog/ })).toContainText('3');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Backlog' }),
    ).toContainText('3');
  } finally {
    await server.stop();
  }
});

test('mobile: Add task opens the capture sheet; Add closes it and shows the task first', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, ['One']);
    await page.goto(`${server.url}/backlog`);
    await page.getByRole('button', { name: 'Add task' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('New task')).toBeVisible();
    await sheet.getByRole('textbox').fill(TITLE);
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(rows(page).first()).toContainText(TITLE);
  } finally {
    await server.stop();
  }
});

test('desktop: opening a row sets ?task=<id>, survives reload, and the empty panel shows its prompt', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, [TITLE]);
    await page.goto(`${server.url}/backlog`);
    await expect(page.getByText('Select a task to add details')).toBeVisible();

    await rows(page).first().click();
    await expect(page).toHaveURL(/[?&]task=[0-9A-Z]{26}/);
    const detail = page.getByRole('complementary');
    await expect(detail).toContainText(TITLE);
    await expect(page.getByText('Select a task to add details')).toBeHidden();

    await page.reload();
    await expect(page).toHaveURL(/[?&]task=[0-9A-Z]{26}/);
    await expect(page.getByRole('complementary')).toContainText(TITLE);
  } finally {
    await server.stop();
  }
});

test('tablet 1000x800: the detail opens as a drawer over a scrim; Escape closes it and drops task from the URL', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, [TITLE]);
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto(`${server.url}/backlog`);
    await rows(page).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText(TITLE);
    await expect(page.getByTestId('scrim')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page).not.toHaveURL(/task=/);
  } finally {
    await server.stop();
  }
});
