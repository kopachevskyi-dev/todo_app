import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`quick add validates titles in every column in ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    for (const name of ['Backlog', 'Today', 'Tomorrow']) {
      const column = page.getByRole('region', { name, exact: true });
      const input = column.getByRole('textbox', { name: 'Add task' });
      await expect(input).toBeVisible();
      await input.fill('   ');
      await input.press('Enter');
      await expect(page.getByRole('alert')).toHaveText('Enter a title.');
      await expect(column.getByRole('button', { name: /^\s*$/ })).toHaveCount(0);
      const title = `${name} quick add ${theme} ${Date.now()}`;
      await input.fill(`  ${title}  `);
      await input.press('Enter');
      await expect(column.getByRole('button', { name: title, exact: true })).toBeVisible();
      await expect(input).toHaveValue('');
      await page.reload();
      await expect(column.getByRole('button', { name: title, exact: true })).toBeVisible();
    }
  });

  test(`quick add, edit with Esc, done and delete Undo persist in ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    const title = `Task ${theme} ${Date.now()}`;
    const today = page.getByRole('region', { name: 'Today', exact: true });
    const input = today.getByRole('textbox', { name: 'Add task' });
    await input.fill('   ');
    await input.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Enter a title.');
    await expect(today.getByRole('button', { name: title, exact: true })).toHaveCount(0);
    await input.fill(title);
    await input.press('Enter');
    await today.getByRole('button', { name: title, exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Task details' });
    await panel.getByRole('textbox', { name: 'Title', exact: true }).fill(`${title} edited`);
    await panel.getByRole('textbox', { name: 'Note' }).fill('Some context');
    await panel.getByLabel('Priority').selectOption('high');
    await expect(panel.getByRole('status')).toHaveText('Saved');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await page.reload();
    await today.getByRole('button', { name: `${title} edited`, exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Note' })).toHaveValue('Some context');
    await expect(panel.getByLabel('Priority')).toHaveValue('high');
    await page.keyboard.press('Escape');
    const card = today.getByRole('listitem').filter({ has: page.getByRole('button', { name: `${title} edited`, exact: true }) });
    await Promise.all([page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/api/tasks/')), card.getByRole('checkbox').check()]);
    await expect(card.getByRole('checkbox')).toBeChecked();
    await page.reload();
    await expect(card.getByRole('checkbox')).toBeChecked();
    await card.getByRole('button').click();
    await panel.getByRole('button', { name: 'Delete task' }).click();
    await expect(today.getByRole('button', { name: `${title} edited`, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(card).toBeVisible();
    await page.reload();
    await expect(card.getByRole('checkbox')).toBeChecked();
  });
}
