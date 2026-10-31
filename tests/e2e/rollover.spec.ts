import { expect, test } from '@playwright/test';

for (const trigger of ['timer', 'visibility']) {
  test(`rollover refreshes Plan on ${trigger} and shows the Not done label on Backlog`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-31T22:59:00Z') });
    let crossedMidnight = false;
    const task = { id: 'unfinished', title: 'Finish report', note: 'Keep context', priority: 'high', status: 'open', tags: [], placement: '2026-10-31', notDoneFrom: null };
    await page.route('**/api/plan', route => route.fulfill({ json: crossedMidnight ? {
      backlog: [{ ...task, id: 'copy', placement: 'backlog', notDoneFrom: '2026-10-31' }],
      today: { date: '2026-11-01', tasks: [], reflection: '', done: 0, total: 0 }, tomorrow: { date: '2026-11-02', tasks: [], reflection: '', done: 0, total: 0 },
      yesterday: { date: '2026-10-31', reflection: '', showReflectionPrompt: false },
    } : {
      backlog: [], today: { date: '2026-10-31', tasks: [task], reflection: '', done: 0, total: 1 }, tomorrow: { date: '2026-11-01', tasks: [], reflection: '', done: 0, total: 0 },
      yesterday: { date: '2026-10-30', reflection: '', showReflectionPrompt: false },
    } }));
    await page.route('**/api/health', route => route.fulfill({ json: { server: 'ready', database: 'ready', timezone: 'Europe/Warsaw', now: crossedMidnight ? '2026-10-31T23:01:00Z' : '2026-10-31T22:59:00Z' } }));
    await page.goto('/');
    const today = page.getByRole('region', { name: 'Today', exact: true });
    await expect(today.getByRole('button', { name: 'Finish report', exact: true })).toBeVisible();
    await today.getByRole('button', { name: 'Finish report', exact: true }).click();
    crossedMidnight = true;
    if (trigger === 'timer') await page.clock.fastForward(30_000);
    else await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const backlog = page.getByRole('region', { name: 'Backlog', exact: true });
    await expect(backlog.getByText('Not done · Oct 31', { exact: true })).toBeVisible();
    await expect(backlog.getByRole('button', { name: 'Finish report', exact: true })).toBeVisible();
    await expect(today.getByRole('button', { name: 'Finish report', exact: true })).toHaveCount(0);
    await expect(today.locator('time')).toHaveText('2026-11-01');
    await expect(page.getByRole('dialog', { name: 'Task details' })).toHaveCount(0);
  });
}
