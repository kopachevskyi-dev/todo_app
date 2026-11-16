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
const listChip = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Filter by list', exact: true })
    .getByRole('button', { name: new RegExp(`^${name}\\b`) });

test('desktop: create, rename, recolor and delete a list; its tasks stay without a list', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, top bar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Buy stamps', 'Work');
    await page.goto(`${server.url}/backlog`);

    await page
      .getByRole('button', { name: 'Manage lists', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Manage lists', exact: true })
      .getByRole('button', { name: 'New list', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: /list name|new list/i })
      .fill('Errands');
    await page.keyboard.press('Enter');
    await page
      .getByRole('dialog', { name: 'Manage lists', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    const lists = page
      .getByRole('group', { name: 'Filter by list', exact: true })
      .getByRole('button');
    await expect(lists.last()).toContainText('Errands');
    await expect(lists.last().locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(58, 167, 122)',
    );

    await page
      .getByRole('button', { name: 'Manage lists', exact: true })
      .click();
    const manage = page.getByRole('dialog');
    await manage
      .getByRole('button', { name: 'Edit Errands', exact: true })
      .click();
    const form = page.getByRole('dialog').last();
    await form.getByRole('textbox', { name: /list name/i }).fill('Shop');
    await form.getByRole('button', { name: 'Lavender', exact: true }).click();
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(lists.last()).toContainText('Shop');
    await expect(lists.last().locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(139, 106, 216)',
    );

    await manage
      .getByRole('button', { name: 'Delete Work', exact: true })
      .click();
    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toContainText(
      'Delete list "Work"? Its tasks stay, without a list.',
    );
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await manage.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(listChip(page, 'Work')).toHaveCount(0);
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
    'Exercises desktop keyboard, top bar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Plan sprint', 'Work');
    await seed(server.url, 'Fix the shelf', 'Home');
    await page.goto(`${server.url}/backlog`);

    await listChip(page, 'Work').click();
    await expect(page).toHaveURL(/[?&]lists=/);
    await expect(listChip(page, 'Work')).toHaveAttribute(
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

    await listChip(page, 'Work').click();
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
    'Exercises desktop keyboard, top bar or detail panel layout.',
  );
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/backlog`);
    await page
      .getByRole('button', { name: 'Manage lists', exact: true })
      .click();
    await newListButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'New list', exact: true });
    await dialog.getByRole('textbox', { name: /name/i }).fill('Errands');
    await dialog.getByRole('button', { name: /^Sky/ }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    await page
      .getByRole('dialog', { name: 'Manage lists', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    const item = listChip(page, 'Errands');
    await expect(item).toBeVisible();
    await expect(item.locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(74, 134, 232)',
    );
    await page.reload();
    await expect(listChip(page, 'Errands').locator('.list-dot')).toHaveCSS(
      'background-color',
      'rgb(74, 134, 232)',
    );
  } finally {
    await server.stop();
  }
});

test('desktop: renaming and recoloring a list in Manage lists shows Shop in Tangerine everywhere after reload', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'Exercises desktop keyboard, top bar or detail panel layout.',
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
    await form.getByRole('button', { name: /^Tangerine/ }).click();
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await page.reload();

    const tangerine = 'rgb(238, 125, 59)';
    await expect(listChip(page, 'Shop').locator('.list-dot')).toHaveCSS(
      'background-color',
      tangerine,
    );
    const row = rows(page).filter({ hasText: 'Buy milk' });
    await expect(row).toContainText('Shop');
    await expect(row.locator('.list-dot')).toHaveCSS(
      'background-color',
      tangerine,
    );
    await row.click();
    await page
      .getByRole('complementary', { name: 'Task details' })
      .getByRole('button', { name: /^List/ })
      .click();
    await expect(
      page.getByRole('button', { name: /^List Shop/ }),
    ).toBeVisible();
    await expect(page.locator('.list-dot').last()).toHaveCSS(
      'background-color',
      tangerine,
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
      name: /^(Mint|Sky|Sun|Coral|Lavender|Tangerine|Ocean|Plum)/,
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
    const desktop = test.info().project.name === 'desktop';
    if (desktop)
      await page
        .getByRole('button', { name: 'Manage lists', exact: true })
        .click();
    const opener = newListButton(page);
    await opener.focus();
    await opener.press('Enter');
    const form = page.getByRole('dialog', { name: 'New list', exact: true });
    await expect(form).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(form).toHaveCount(0);
    if (desktop)
      await expect(
        page.getByRole('dialog', { name: 'Manage lists', exact: true }),
      ).toBeVisible();
    await expect(opener).toBeFocused();
  } finally {
    await server.stop();
  }
});
