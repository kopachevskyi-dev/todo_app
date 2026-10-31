import { expect, test } from '@playwright/test';

test('Plan and History tabs show their empty screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  await expect(page.getByText('Your past days will appear here.')).toBeVisible();
});

test('theme follows changes to the system color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(236, 236, 234)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
});

test('Geist Mono loads locally for text and controls', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'font') fonts.push(request.url()); });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toHaveCSS('font-family', /Geist Mono Variable/);
  await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toHaveCSS('font-family', /Geist Mono Variable/);
  await expect(page.locator('html')).toHaveCSS('font-variant-numeric', 'tabular-nums');
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('15px "Geist Mono Variable"'))).toBe(true);
});
