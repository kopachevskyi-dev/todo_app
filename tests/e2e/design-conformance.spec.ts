import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test('opened List field has aria-expanded and a 2px solid blue border', async ({
  page,
  isMobile: mobile,
}) => {
  const server = await startTestServer(page);
  try {
    const created = await fetch(`${server.url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
      body: JSON.stringify({ title: 'Renew license', target: 'backlog' }),
    });
    expect(created.status).toBe(201);
    await page.goto(`${server.url}/backlog`);
    await rows(page).first().click();

    const detail = mobile
      ? page.getByRole('main')
      : page.getByRole('complementary', { name: 'Task details' });
    await expect(
      detail.getByRole('textbox', { name: 'Title', exact: true }),
    ).toBeVisible();
    const listField = detail.getByRole('button', { name: /^List/ });
    await listField.click();

    await expect(listField).toHaveAttribute('aria-expanded', 'true');
    await expect(listField).toHaveCSS('border-top-width', '2px');
    await expect(listField).toHaveCSS('border-top-style', 'solid');
    await expect(listField).toHaveCSS('border-top-color', 'rgb(74, 134, 232)');
  } finally {
    await server.stop();
  }
});

test('a focused interactive element uses the v3 focus color rgb(74, 134, 232)', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(server.url);
    await expect(
      page
        .getByRole('main')
        .getByRole('heading', { name: 'Today', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    await expect(focused).toHaveCSS('outline-color', 'rgb(74, 134, 232)');
  } finally {
    await server.stop();
  }
});

test('a Today row checkbox is circular', async ({ page }) => {
  const server = await startTestServer(page);
  try {
    const created = await fetch(`${server.url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Timezone': 'UTC' },
      body: JSON.stringify({ title: 'Pay rent', target: 'today' }),
    });
    expect(created.status).toBe(201);
    await page.goto(`${server.url}/today`);
    const box = rows(page)
      .filter({ hasText: 'Pay rent' })
      .getByRole('checkbox')
      .locator('.checkbox');
    await expect(box).toHaveCSS('border-top-left-radius', '50%');
    await expect(box).toHaveCSS('border-bottom-right-radius', '50%');
  } finally {
    await server.stop();
  }
});

test('the body font is Lexend at weight 300', async ({ page }) => {
  const server = await startTestServer(page);
  try {
    await page.goto(server.url);
    const body = page.locator('body');
    await expect(body).toHaveCSS('font-family', /^"?Lexend"?,/);
    await expect(body).toHaveCSS('font-weight', '300');
  } finally {
    await server.stop();
  }
});
