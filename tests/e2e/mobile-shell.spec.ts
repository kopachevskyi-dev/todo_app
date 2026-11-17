import { test, expect, type Page } from '@playwright/test';
import { startTestServer } from '../helpers/e2e-clock';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'mobile',
    'The tab bar and header search icon are for widths below 768px.',
  );
});

const tabBar = (page: Page) =>
  page.getByRole('navigation', { name: 'Sections' });

test('mobile: the tab bar shows Today, Backlog, Upcoming, History and an add button', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);

    for (const name of ['Today', 'Backlog', 'Upcoming', 'History']) {
      await expect(
        tabBar(page).getByRole('link', { name: new RegExp(`^${name}\\b`) }),
      ).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /^Add task/ })).toBeVisible();
  } finally {
    await server.stop();
  }
});

test('mobile: tapping the header search icon on each tab screen opens the search route with its field focused', async ({
  page,
}) => {
  const server = await startTestServer(page);
  try {
    await page.goto(`${server.url}/today`);

    for (const [name, path] of [
      ['Today', '/today'],
      ['Backlog', '/backlog'],
      ['Upcoming', '/upcoming'],
      ['History', '/history'],
    ] as const) {
      await tabBar(page)
        .getByRole('link', { name: new RegExp(`^${name}\\b`) })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));

      await page
        .getByRole('main')
        .getByRole('button', { name: 'Search' })
        .click();

      await expect(page).toHaveURL(/\/search/);
      await expect(page.getByRole('textbox')).toBeFocused();
    }
  } finally {
    await server.stop();
  }
});
