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
/** The capture area: the desktop field's screen, or the mobile sheet once opened. */
async function openCapture(page: Page) {
  if (mobile()) {
    await page.getByRole('button', { name: 'Add task' }).click();
    return page.getByRole('dialog', { name: 'New task' });
  }
  return page.getByRole('main');
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
async function pickWed11(page: Page, area: ReturnType<Page['locator']>) {
  await area.getByRole('button', { name: /^Day/ }).click();
  await page
    .getByRole('button', { name: /Wed,? (Nov )?11/ })
    .first()
    .click();
  const save = page.getByRole('button', { name: 'Save date' });
  if (await save.isVisible()) await save.click();
}

test('Today: Enter with default controls adds the task to Today with no list', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    const area = await openCapture(page);
    await expect(
      area.getByRole('button', { name: /^List No list/ }),
    ).toBeVisible();
    await expect(area.getByRole('button', { name: /^Day/ })).toContainText(
      'Tue, Nov 10',
    );
    await field(area).fill('Pay rent');
    await add(area);

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

test('Today: Dentist with Day Wed, Nov 11 leaves Today, announces Added to Wed, Nov 11 and Open shows it', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    const area = await openCapture(page);
    await field(area).fill('Dentist');
    await pickWed11(page, area);
    await add(area);

    await expect(rows(page).filter({ hasText: 'Dentist' })).toHaveCount(0);
    const note = page.getByRole('status').filter({
      hasText: 'Added to Wed, Nov 11',
    });
    await expect(note).toBeVisible();
    await note.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByText('Dentist').first()).toBeVisible();
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

    await page.getByRole('button', { name: /^List/ }).click();
    await page.getByRole('button', { name: 'New list', exact: true }).click();
    const form = page.getByRole('dialog').last();
    await form.getByRole('textbox', { name: /name/i }).fill('Repairs');
    await form.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('button', { name: /^List/ })).toContainText(
      'Repairs',
    );
  } finally {
    await server.stop();
  }
});

test('a failed add with the server stopped shows the error and keeps title and Day', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);
    const area = await openCapture(page);
    await field(area).fill('Dentist');
    await pickWed11(page, area);
    await server.stop();
    await add(area);

    await expect(area.getByRole('alert')).toBeVisible();
    await expect(field(area)).toHaveValue('Dentist');
    await expect(area.getByRole('button', { name: /^Day/ })).toContainText(
      'Wed, Nov 11',
    );
  } finally {
    await server.stop();
  }
});
