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

const newListButton = (page: Page) =>
  page.getByRole('button', { name: 'New list', exact: true });

test('desktop: a new list is created with its color in one form and keeps it after reload', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/backlog`);
    await newListButton(page).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: /name/i }).fill('Errands');
    await dialog.getByRole('button', { name: /^Blue/ }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    const item = sidebarItem(page, 'Errands');
    await expect(item).toBeVisible();
    await expect(item.locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(106, 147, 212)',
    );
    await page.reload();
    await expect(sidebarItem(page, 'Errands').locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(106, 147, 212)',
    );
  } finally {
    await server.stop();
  }
});

test('desktop: renaming and recoloring a list in Manage lists shows Shop in Orange everywhere after reload', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, sidebar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    const created = await fetch(`${server.url}/api/lists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Errands' }),
    });
    expect(created.status).toBe(201);
    await seed(server.url, 'Buy milk', 'Errands');
    await page.goto(`${server.url}/backlog`);

    await page
      .getByRole('button', { name: 'Manage lists', exact: true })
      .click();
    const manage = page.getByRole('dialog');
    await manage
      .getByRole('button', {
        name: /(edit|rename).*Errands|Errands.*(edit|rename)/i,
      })
      .click();
    const form = page.getByRole('dialog').last();
    await form.getByRole('textbox', { name: /name/i }).fill('Shop');
    await form.getByRole('button', { name: /^Orange/ }).click();
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await page.reload();

    const orange = 'rgb(232, 151, 90)';
    await expect(sidebarItem(page, 'Shop').locator('.list-dot')).toHaveCSS(
      'background-color',
      orange,
    );
    const row = rows(page).filter({ hasText: 'Buy milk' });
    await expect(row).toContainText('Shop');
    await expect(row.locator('.list-dot')).toHaveCSS(
      'background-color',
      orange,
    );
    await row.click();
    await page.getByRole('button', { name: /^List/ }).click();
    await expect(
      page.getByRole('button', { name: /^List Shop/ }),
    ).toBeVisible();
    await expect(page.locator('.list-dot').last()).toHaveCSS(
      'background-color',
      orange,
    );
  } finally {
    await server.stop();
  }
});

test('mobile: with six lists and a 40-character name, the New list form fits the 390 px viewport', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'mobile',
    'Exercises the mobile sheet, screen or navigation layout.',
  );
  const server = await startTestServer(page);
  try {
    for (const name of [
      'Errands',
      'Garden',
      'Books',
      'Travel',
      'A'.repeat(40),
    ]) {
      const created = await fetch(`${server.url}/api/lists`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      });
      expect(created.status).toBe(201);
    }
    await page.goto(`${server.url}/backlog`);
    await newListButton(page).click();

    const dialog = page.getByRole('dialog');
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('Missing viewport');
    const swatchButtons = dialog.getByRole('button', {
      name: /^(Red|Teal|Yellow|Purple|Green|Blue|Orange|Pink)/,
    });
    const targets = [
      dialog.getByRole('textbox', { name: /name/i }),
      swatchButtons,
      dialog.getByRole('button', { name: 'Save', exact: true }),
      dialog.getByRole('button', { name: 'Cancel', exact: true }),
    ];
    const swatches = await swatchButtons.count();
    expect(swatches).toBe(8);
    for (const target of targets) {
      for (let i = 0; i < (await target.count()); i += 1) {
        const box = await target.nth(i).boundingBox();
        if (!box) throw new Error('Control has no box');
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  } finally {
    await server.stop();
  }
});

test('Escape closes the list form and returns focus to the control that opened it', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/backlog`);
    const opener = newListButton(page);
    await opener.focus();
    await opener.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
  } finally {
    await server.stop();
  }
});
