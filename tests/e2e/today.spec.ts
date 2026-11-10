import { test, expect } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

test('shows the Today heading in the browser with the client running', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.url);
    // The main element is rendered by React, so this also checks that JS loaded.
    await expect(
      page.getByRole('main').getByRole('heading', {
        name: 'Today',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toContainText('0 of 0 done');
    expect(errors).toEqual([]);
  } finally {
    await server.stop();
  }
});
