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
async function seedBacklog(url: string, title: string) {
  const created = await fetch(`${url}/api/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, target: 'backlog' }),
  });
  expect(created.status).toBe(201);
}

const mobile = () => test.info().project.name === 'mobile';
const rows = (page: Page) => page.getByRole('main').getByRole('listitem');
/** Open the full capture dialog to choose list and day metadata. */
async function openCapture(page: Page) {
  await page
    .getByRole('button', {
      name: mobile() ? 'Add task' : 'New task',
      exact: true,
    })
    .click();
  return page.getByRole('dialog', { name: 'New task' });
}
const field = (area: ReturnType<Page['locator']>) =>
  area.getByRole('textbox', { name: 'Task title' });
const add = async (area: ReturnType<Page['locator']>) => {
  if (mobile()) {
    await area.getByRole('button', { name: 'Add', exact: true }).click();
  } else {
    await field(area).press('Enter');
  }
};
async function openTodayCapture(page: Page) {
  return mobile()
    ? openCapture(page)
    : page.getByRole('form', { name: 'Quick add', exact: true });
}

test('Today: Enter adds the task to Today with no list', async ({ page }) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    const area = await openTodayCapture(page);
    if (!mobile()) {
      await expect(area.getByRole('button', { name: /^List/ })).toHaveCount(0);
      await expect(area.getByRole('button', { name: /^Day/ })).toHaveCount(0);
    }
    await field(area).fill('Pay rent');
    await field(area).press('Enter');

    await expect(rows(page).filter({ hasText: 'Pay rent' })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: 'Pay rent' })).not.toContainText(
      /Home|Work/,
    );
  } finally {
    await server.stop();
  }
});

test('Backlog filtered to Home only: capture shows List Home and the task joins Home', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const home = await listId(server.url, 'Home');
    await page.goto(`${server.url}/backlog?lists=${home}`);
    const area = await openCapture(page);
    await expect(area.getByRole('button', { name: /^List/ })).toContainText(
      'Home',
    );
    await field(area).fill('Fix tap');
    await add(area);

    const row = rows(page).filter({ hasText: 'Fix tap' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Home');
  } finally {
    await server.stop();
  }
});

test('Backlog filtered to Home and Work: capture starts at No list and says several lists are selected', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const home = await listId(server.url, 'Home');
    const work = await listId(server.url, 'Work');
    await page.goto(`${server.url}/backlog?lists=${home},${work}`);
    const area = await openCapture(page);
    await expect(area.getByRole('button', { name: /^List/ })).toContainText(
      'No list',
    );
    await expect(area).toContainText(/several lists/i);
  } finally {
    await server.stop();
  }
});

test('the task list picker creates a list via New list and the card shows it', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seedBacklog(server.url, 'Fix tap');
    await page.goto(`${server.url}/backlog`);
    await rows(page).filter({ hasText: 'Fix tap' }).first().click();

    const card = mobile()
      ? page.getByRole('main')
      : page.getByRole('complementary', { name: 'Task details' });
    await card.getByRole('button', { name: /^List/ }).click();
    await page
      .getByRole('dialog', { name: 'Choose a list' })
      .getByRole('button', { name: 'New list', exact: true })
      .click();
    const form = page.getByRole('dialog').last();
    await form.getByRole('textbox', { name: /name/i }).fill('Repairs');
    await form.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(card.getByRole('button', { name: /^List/ })).toContainText(
      'Repairs',
    );
  } finally {
    await server.stop();
  }
});

test('Today: a failed add with the server stopped shows the error and keeps the title', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    const area = await openTodayCapture(page);
    await field(area).fill('Dentist');
    await server.stop();
    await add(area);

    await expect(area.getByRole('alert')).toBeVisible();
    await expect(field(area)).toHaveValue('Dentist');
  } finally {
    await server.stop();
  }
});
