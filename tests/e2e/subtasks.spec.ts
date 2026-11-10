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
  return ((await response.json()) as { task: { id: string } }).task.id;
}
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test('desktop: Enter adds each of 3 subtasks and keeps the input open; the backlog row shows "0/3"', async ({
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

    await panel.getByRole('button', { name: 'Add subtask' }).click();
    const input = panel.getByRole('textbox', { name: 'Add subtask' });
    for (const title of [
      'Find the old license',
      'Take a photo',
      'Book an appointment',
    ]) {
      await input.fill(title);
      await input.press('Enter');
      await expect(panel).toContainText(title);
      await expect(input).toBeFocused();
    }
    await expect(
      panel.getByRole('checkbox', {
        name: /Find the old license|Take a photo|Book an appointment/,
      }),
    ).toHaveCount(3);
    await expect(input).toBeVisible();
    await expect(rows(page).first()).toContainText('0/3');
  } finally {
    await server.stop();
  }
});

test('mobile: checking the first, renaming the second and deleting the third subtask persist after reload', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    const id = await seed(server.url, TITLE);
    for (const title of [
      'Find the old license',
      'Take a photo',
      'Book an appointment',
    ]) {
      const response = await fetch(`${server.url}/api/tasks/${id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
        body: JSON.stringify({ title }),
      });
      expect(response.status).toBe(201);
    }
    await page.goto(`${server.url}/backlog`);
    await rows(page).first().click();

    await page.getByRole('checkbox', { name: /Find the old license/ }).check();
    await page.getByText('Take a photo', { exact: true }).click();
    const rename = page.getByRole('textbox', { name: 'Take a photo' });
    await rename.fill('Take a passport photo');
    await rename.press('Enter');
    await page.getByText('Book an appointment', { exact: true }).click();
    await page.getByRole('button', { name: 'Delete subtask' }).click();

    await page.reload();
    await expect(
      page.getByRole('checkbox', { name: /Find the old license/ }),
    ).toBeChecked();
    await expect(page.getByText('Take a passport photo')).toBeVisible();
    await expect(page.getByText('Take a photo', { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText('Book an appointment')).toHaveCount(0);
  } finally {
    await server.stop();
  }
});
