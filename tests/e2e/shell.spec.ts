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
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(248, 249, 245)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(25, 28, 25)');
});
