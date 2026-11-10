import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test('opened List field has aria-expanded and a 2px solid blue border', async ({
  page,
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

    const listField = page.getByRole('button', { name: /^List/ });
    await listField.click();

    await expect(listField).toHaveAttribute('aria-expanded', 'true');
    await expect(listField).toHaveCSS('border-top-width', '2px');
    await expect(listField).toHaveCSS('border-top-style', 'solid');
    await expect(listField).toHaveCSS('border-top-color', 'rgb(47, 111, 222)');
  } finally {
    await server.stop();
  }
});
