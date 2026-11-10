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
  target: 'backlog' | 'today' = 'backlog',
  done = false,
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
  if (done) {
    const completed = await fetch(`${url}/api/tasks/${task.id}/complete`, {
      method: 'POST',
      headers,
    });
    expect(completed.ok).toBe(true);
  }
}
async function createList(url: string, name: string) {
  const created = await fetch(`${url}/api/lists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name }),
  });
  expect(created.status).toBe(201);
}
const main = (page: Page) => page.getByRole('main');
const rows = (page: Page) => main(page).getByRole('listitem');
const listButton = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const sections = (page: Page) =>
  page.getByRole('navigation', { name: 'Sections' });

test('Backlog: Work and Home combine with OR, tasks without a list are left out, scope is shown', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'W1', 'Work');
    await seed(server.url, 'H1', 'Home');
    await seed(server.url, 'N1', null);
    await page.goto(`${server.url}/backlog`);

    await listButton(page, 'Work').click();
    await listButton(page, 'Home').click();

    await expect(listButton(page, 'Work')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(listButton(page, 'Home')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(main(page)).toContainText('W1');
    await expect(main(page)).toContainText('H1');
    await expect(main(page)).not.toContainText('N1');
    await expect(main(page)).toContainText('Showing: Work, Home');
    await expect(page).toHaveURL(/[?&]lists=[^&]+,[^&]+/);
  } finally {
    await server.stop();
  }
});

test('Backlog: Show all clears the filter and includes tasks without a list', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'W1', 'Work');
    await seed(server.url, 'H1', 'Home');
    await seed(server.url, 'N1', null);
    await page.goto(`${server.url}/backlog`);
    await listButton(page, 'Work').click();
    await listButton(page, 'Home').click();
    await expect(main(page)).not.toContainText('N1');

    await main(page).getByRole('button', { name: 'Show all' }).click();

    await expect(main(page)).toContainText('W1');
    await expect(main(page)).toContainText('H1');
    await expect(main(page)).toContainText('N1');
  } finally {
    await server.stop();
  }
});

test('the Backlog filter does not follow navigation to Today, and Back restores it', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await createList(server.url, 'School');
    for (const title of ['T1', 'T2', 'T3', 'T4', 'T5']) {
      await seed(server.url, title, 'Work', 'today');
    }
    await page.goto(`${server.url}/backlog`);
    await listButton(page, 'School').click();
    await expect(listButton(page, 'School')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await sections(page).getByRole('link', { name: /Today/ }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page).not.toHaveURL(/lists=/);
    await expect(rows(page)).toHaveCount(5);

    await page.goBack();
    await expect(page).toHaveURL(/\/backlog/);
    await expect(listButton(page, 'School')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await server.stop();
  }
});

test('Today: a filter without matches says so, offers Show all and keeps the whole-day progress', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await createList(server.url, 'School');
    for (const title of ['T1', 'T2', 'T3', 'T4', 'T5']) {
      await seed(server.url, title, 'Work', 'today');
    }
    await page.goto(`${server.url}/today`);
    await listButton(page, 'School').click();

    await expect(main(page)).toContainText('No School tasks planned for today');
    await expect(
      main(page).getByRole('button', { name: 'Show all' }),
    ).toBeVisible();
    await expect(main(page)).toContainText('0 of 5 done');
  } finally {
    await server.stop();
  }
});

test('Today: nothing planned offers Add from Backlog when the backlog has tasks', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'B1', null);
    await seed(server.url, 'B2', null);
    await page.goto(`${server.url}/today`);

    await expect(
      main(page).getByText('Nothing planned for today', { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Add from Backlog' }),
    ).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('Today: nothing planned and an empty backlog offers Add a task', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);

    await expect(main(page)).toContainText('Nothing planned for today');
    await expect(
      main(page).getByRole('button', { name: 'Add a task' }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Add from Backlog' }),
    ).toHaveCount(0);
  } finally {
    await server.stop();
  }
});

test('Today: all tasks done says so and keeps the Completed group visible', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await seed(server.url, 'D1', null, 'today', true);
    await seed(server.url, 'D2', null, 'today', true);
    await page.goto(`${server.url}/today`);

    await expect(main(page)).toContainText('All done for today');
    await expect(
      main(page).getByRole('heading', { name: 'Completed' }),
    ).toBeVisible();
    await expect(main(page)).toContainText('D1');
    await expect(main(page)).toContainText('D2');
  } finally {
    await server.stop();
  }
});

test('desktop: the History filter survives a reload', async ({ page }) => {
  test.skip(
    test.info().project.name !== 'desktop',
    'History shows list controls only in the desktop sidebar.',
  );
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/history`);
    await listButton(page, 'Work').click();
    await expect(listButton(page, 'Work')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.reload();

    await expect(page).toHaveURL(/lists=/);
    await expect(listButton(page, 'Work')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await server.stop();
  }
});
