import { test, expect } from '@playwright/test';
import { startTestServer } from '../../scripts/test-server.mjs';

test('shows the Today heading in the browser with the client running', async ({
  page,
}) => {
  const server = await startTestServer();
  try {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.url);
    // The main element is rendered by React, so this also checks that JS loaded.
    await expect(
      page
        .getByRole('main')
        .getByRole('heading', { name: 'Today', exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await server.stop();
  }
});
