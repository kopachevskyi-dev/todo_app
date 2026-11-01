import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1280, 375]) {
    test(`task panel fits ${width}px in ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if (width === 375) await page.getByRole('tab', { name: 'Backlog', exact: true }).click();
      const backlog = page.getByRole('region', { name: 'Backlog', exact: true });
      const title = `Panel ${theme} ${width} ${Date.now()}`;
      await backlog.getByRole('textbox', { name: 'Add task' }).fill(title);
      await backlog.getByRole('textbox', { name: 'Add task' }).press('Enter');
      await backlog.getByRole('button', { name: title, exact: true }).click();
      const panel = page.getByRole('dialog', { name: 'Task details' });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS('padding', width === 375 ? '20px' : '32px');
      await expect(panel).toHaveCSS('border-top-left-radius', width === 375 ? '0px' : '28px');
      await expect(panel).toHaveCSS('animation-name', 'fade-in');
      expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      const box = await panel.boundingBox();
      expect(box?.x).toBe(width === 375 ? 0 : 832);
      expect(box?.width).toBe(width === 375 ? 375 : 448);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.keyboard.press('Escape');
      await expect(backlog.getByRole('button', { name: title, exact: true })).toBeFocused();
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`panel, tag chips, editor and Undo show keyboard focus in ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    const backlog = page.getByRole('region', { name: 'Backlog', exact: true });
    const title = `Keyboard panel ${theme} ${Date.now()}`;
    await backlog.getByRole('textbox', { name: 'Add task' }).fill(title);
    await backlog.getByRole('textbox', { name: 'Add task' }).press('Enter');
    await backlog.getByRole('button', { name: title, exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Task details' });
    await page.keyboard.press('Tab');
    for (const field of [panel.getByRole('textbox', { name: 'Title', exact: true }), panel.getByRole('textbox', { name: 'Note' }), panel.getByLabel('Priority')]) {
      await field.focus();
      await expect(field).toHaveCSS('border-color', 'rgb(223, 255, 95)');
      await expect(field).toHaveCSS('text-transform', 'none');
      await expect(field).toHaveCSS('letter-spacing', 'normal');
    }
    const tags = panel.getByRole('button', { name: 'Tags', exact: true });
    await tags.click();
    const work = panel.getByRole('checkbox', { name: 'work', exact: true });
    await page.keyboard.press('Tab');
    await work.focus();
    await expect(work).toBeFocused();
    const workChip = panel.getByText('work', { exact: true });
    await expect(workChip).toHaveCSS('outline-color', 'rgb(223, 255, 95)');
    await expect(workChip).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Space');
    await expect(work).toBeChecked();
    await expect(workChip).toHaveCSS('background-color', 'rgb(223, 255, 95)');
    await expect(workChip).toHaveCSS('color', 'rgb(10, 10, 10)');
    await panel.getByRole('button', { name: 'Edit tags', exact: true }).click();
    const editor = panel.getByRole('region', { name: 'Edit tags', exact: true });
    await page.keyboard.press('Tab');
    for (const name of ['Tag name', 'New tag name']) {
      const input = editor.getByRole('textbox', { name, exact: true }).first();
      await input.focus();
      await expect(input).toHaveCSS('border-color', 'rgb(223, 255, 95)');
    }
    for (const input of [editor.getByLabel('Tag color', { exact: true }).first(), editor.getByLabel('New tag color')]) {
      await input.focus();
      await expect(input).toHaveCSS('outline-color', 'rgb(223, 255, 95)');
      await expect(input).toHaveCSS('outline-width', '2px');
    }
    for (const name of ['Close task details', 'Tags', 'Edit tags', 'Save tag', 'Delete tag', 'Add tag', 'Delete task']) {
      const button = panel.getByRole('button', { name, exact: true }).first();
      await button.focus();
      await expect(button).toHaveCSS('outline-color', 'rgb(223, 255, 95)');
      await expect(button).toHaveCSS('outline-width', '2px');
    }
    await expect(panel.getByRole('status')).toHaveText('Saved');
    await panel.getByRole('button', { name: 'Delete task', exact: true }).press('Enter');
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    await undo.focus();
    await expect(undo).toHaveCSS('outline-color', 'rgb(223, 255, 95)');
    await expect(undo).toHaveCSS('outline-width', '2px');
    await undo.press('Enter');
    await expect(backlog.getByRole('button', { name: title, exact: true })).toBeVisible();
  });
}
