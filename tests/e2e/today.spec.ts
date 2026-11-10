import { test, expect } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

test('shows the Today heading in the browser with the client running', async ({
  page,
  isMobile,
}) => {
  const server = await startTestServer(page);
  try {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.url);
    // The main element is rendered by React, so this also checks that JS loaded.
    await expect(
      page.getByRole('main').getByRole('heading', {
        name: isMobile ? 'Today 0' : 'Today',
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await server.stop();
  }
});
