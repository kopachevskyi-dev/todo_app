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
    .getByRole('main')
    .getByRole('button', { name: new RegExp(`^${name}\\b`) });

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

const mobile = () => test.info().project.name === 'mobile';
const card = (page: Page) =>
  mobile()
    ? page.getByRole('main')
    : page.getByRole('complementary', { name: 'Task details' });
const listField = (page: Page) =>
  card(page).getByRole('button', { name: /^List/ });
const picker = (page: Page) =>
  page.getByRole('dialog', { name: 'Choose a list', exact: true });

async function openPicker(page: Page, title: string) {
  await rows(page).filter({ hasText: title }).first().click();
  await listField(page).click();
}

test('Choose a list: New list with name Home and a color creates the list and assigns it to the task', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    // Home is seeded; free the name so "Home" can be created.
    const removed = await fetch(
      `${server.url}/api/lists/${await listId(server.url, 'Home')}`,
      { method: 'DELETE', headers },
    );
    expect(removed.status).toBeLessThan(300);
    await seed(server.url, 'Fix tap', null);
    await page.goto(`${server.url}/backlog`);
    await openPicker(page, 'Fix tap');
    await picker(page)
      .getByRole('button', { name: 'New list', exact: true })
      .click();
    const form = page.getByRole('dialog', { name: 'New list', exact: true });
    await form.getByRole('textbox', { name: /name/i }).fill('Home');
    await form.getByRole('button', { name: /^Sky/ }).click();
    await form.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(listField(page)).toContainText('Home');
    const response = await fetch(`${server.url}/api/lists`, { headers });
    const { lists } = (await response.json()) as {
      lists: { name: string; color: string }[];
    };
    expect(lists.find((list) => list.name === 'Home')?.color).toBe('#4a86e8');
  } finally {
    await server.stop();
  }
});

test('Choose a list: renaming a list to Errands and recoloring it to Tangerine shows both on chips and rows', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Buy milk', 'Home');
    await page.goto(`${server.url}/backlog`);
    await openPicker(page, 'Buy milk');
    await picker(page)
      .getByRole('button', { name: 'Edit Home', exact: true })
      .click();
    const form = page.getByRole('dialog', { name: 'Edit list', exact: true });
    await form.getByRole('textbox', { name: /name/i }).fill('Errands');
    await form.getByRole('button', { name: /^Tangerine/ }).click();
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toHaveCount(0);
    await page.keyboard.press('Escape');

    const tangerine = 'rgb(238, 125, 59)';
    const row = rows(page).filter({ hasText: 'Buy milk' });
    await expect(row).toContainText('Errands');
    await expect(row).not.toContainText('Home');
    await expect(row.locator('.list-dot')).toHaveCSS(
      'background-color',
      tangerine,
    );
    if (!mobile()) {
      await expect(listChip(page, 'Errands').locator('.list-dot')).toHaveCSS(
        'background-color',
        tangerine,
      );
    }
  } finally {
    await server.stop();
  }
});

test('Choose a list: deleting a list with tasks after confirming leaves its tasks without a list', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'Plan sprint', 'Work');
    await page.goto(`${server.url}/backlog`);
    await openPicker(page, 'Plan sprint');
    await picker(page)
      .getByRole('button', { name: 'Edit Work', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Edit list', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    const confirm = page.getByRole('dialog').last();
    await expect(confirm).toContainText(
      'Delete list "Work"? Its tasks stay, without a list.',
    );
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();

    const row = rows(page).filter({ hasText: 'Plan sprint' });
    await expect(row).toHaveCount(1);
    await expect(row).not.toContainText('Work');
    await row.first().click();
    await expect(listField(page)).toContainText('No list');
  } finally {
    await server.stop();
  }
});

test('there is no Manage lists link or screen', async ({ page }) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/backlog`);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText('Manage lists')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /manage lists/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: /manage lists/i })).toHaveCount(
      0,
    );
  } finally {
    await server.stop();
  }
});
