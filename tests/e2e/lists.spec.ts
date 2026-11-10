import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const headers = { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' };

async function listId(url: string, name: string) {
  const response = await fetch(`${url}/api/lists`, { headers });
  const { lists } = (await response.json()) as {
    lists: { id: string; name: string }[];
  };
  const found = lists.find((list) => list.name === name);
  if (!found) throw new Error(`Missing list ${name}`);
  return found.id;
}
async function seed(
  url: string,
  title: string,
  list: string | null,
  target = 'backlog',
) {
  const created = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, target }),
  });
  expect(created.status).toBe(201);
  const { task } = (await created.json()) as { task: { id: string } };
  if (list) {
    const patched = await fetch(`${url}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ listId: await listId(url, list) }),
    });
    expect(patched.status).toBe(200);
  }
}
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
const sidebarItem = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}$`) });

test('desktop: create, rename, recolor and delete a list; its tasks stay without a list', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Buy stamps', 'Work');
    await page.goto(`${server.url}/backlog`);

    await page.getByText('New list', { exact: true }).click();
    await page
      .getByRole('textbox', { name: /list name|new list/i })
      .fill('Errands');
    await page.keyboard.press('Enter');
    const lists = page.locator('.lists .list-link, .lists [aria-pressed]');
    await expect(lists.last()).toContainText('Errands');
    await expect(lists.last().locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(142, 124, 195)',
    );

    const menuButton = (name: string) =>
      page.getByRole('button', {
        name: new RegExp(
          `${name}.*(menu|options)|(menu|options).*${name}`,
          'i',
        ),
      });
    await menuButton('Errands').click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const rename = page.getByRole('textbox', { name: /list name|rename/i });
    await rename.fill('Shop');
    await rename.press('Enter');
    await expect(lists.last()).toContainText('Shop');

    await menuButton('Shop').click();
    await page.getByRole('menuitem', { name: 'Color' }).click();
    await page.getByRole('button', { name: 'Green' }).click();
    await expect(lists.last().locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(111, 191, 138)',
    );

    await menuButton('Work').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(
      'Delete list "Work"? Its tasks stay, without a list.',
    );
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('navigation').getByText('Work')).toHaveCount(0);
    await expect(rows(page).first()).toContainText('Buy stamps');
    await expect(rows(page).first()).not.toContainText('Work');
  } finally {
    await server.stop();
  }
});

test('desktop: clicking a list filters Backlog, quick-add joins that list, clicking again clears', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Plan sprint', 'Work');
    await seed(server.url, 'Fix the shelf', 'Home');
    await page.goto(`${server.url}/backlog`);

    await sidebarItem(page, 'Work').click();
    await expect(page).toHaveURL(/[?&]lists=/);
    await expect(sidebarItem(page, 'Work')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Plan sprint');

    const field = page.getByPlaceholder('Add to backlog');
    await field.fill('Send report');
    await field.press('Enter');
    await expect(rows(page).first()).toContainText('Send report');
    await expect(rows(page).first()).toContainText('Work');

    await sidebarItem(page, 'Work').click();
    await expect(page).not.toHaveURL(/[?&]lists=/);
    await expect(rows(page)).toHaveCount(3);
  } finally {
    await server.stop();
  }
});

test('mobile: the Home chip filters Today and Show all clears it', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Water plants', 'Home', 'today');
    await seed(server.url, 'Email boss', 'Work', 'today');
    await page.goto(`${server.url}/today`);
    await expect(rows(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Water plants');

    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    await expect(rows(page)).toHaveCount(2);
  } finally {
    await server.stop();
  }
});
