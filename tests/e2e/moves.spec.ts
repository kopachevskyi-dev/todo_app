import { expect, test, type Locator, type Page } from '@playwright/test';

async function drag(page: Page, handle: Locator, target: Locator, edge = 'center') {
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('Missing drag target');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + (edge === 'top' ? 4 : to.height / 2), { steps: 20 });
  await page.mouse.up();
}

test('drag from Backlog into Today at the drop position, reorder and drag back; order survives reload', async ({ page, request }) => {
  const plan = await (await request.get('/api/plan')).json();
  const suffix = Date.now();
  const titles = [`First ${suffix}`, `Second ${suffix}`, `Dragged ${suffix}`];
  for (const [index, title] of titles.entries()) await request.post('/api/tasks', { data: { title, placement: index === 2 ? 'backlog' : plan.today.date } });
  await page.goto('/');
  const today = page.getByRole('region', { name: 'Today', exact: true });
  const backlog = page.getByRole('region', { name: 'Backlog', exact: true });
  const card = (column: Locator, title: string) => column.getByRole('listitem').filter({ has: page.getByRole('button', { name: title, exact: true }) });
  await drag(page, backlog.getByRole('button', { name: `Drag ${titles[2]}`, exact: true }), card(today, titles[1]), 'top');
  await expect(today.getByRole('button', { name: titles[2], exact: true })).toBeVisible();
  const ordered = () => today.getByRole('listitem').filter({ hasText: new RegExp(suffix.toString()) }).getByRole('button', { name: new RegExp(`^(First|Second|Dragged) ${suffix}$`) });
  await expect(ordered()).toHaveText([titles[0], titles[2], titles[1]]);
  await drag(page, today.getByRole('button', { name: `Drag ${titles[1]}`, exact: true }), card(today, titles[0]), 'top');
  await expect(ordered()).toHaveText([titles[1], titles[0], titles[2]]);
  await page.reload();
  await expect(ordered()).toHaveText([titles[1], titles[0], titles[2]]);
  await drag(page, today.getByRole('button', { name: `Drag ${titles[2]}`, exact: true }), backlog.getByRole('heading'));
  await expect(backlog.getByRole('button', { name: titles[2], exact: true })).toBeVisible();
});

test('narrow screen has column tabs and Move to appends to the target Day', async ({ page, request }) => {
  const plan = await (await request.get('/api/plan')).json();
  const title = `Mobile ${Date.now()}`;
  const anchor = `${title} earlier`;
  await request.post('/api/tasks', { data: { title: anchor, placement: plan.tomorrow.date } });
  await request.post('/api/tasks', { data: { title, placement: 'backlog' } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'Plan columns' });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Backlog', exact: true })).toBeHidden();
  await tabs.getByRole('tab', { name: 'Backlog', exact: true }).click();
  const backlog = page.getByRole('region', { name: 'Backlog', exact: true });
  const card = backlog.getByRole('listitem').filter({ has: page.getByRole('button', { name: title, exact: true }) });
  await card.getByRole('combobox', { name: `Move ${title} to…`, exact: true }).selectOption(plan.tomorrow.date);
  await tabs.getByRole('tab', { name: 'Tomorrow', exact: true }).click();
  const tomorrow = page.getByRole('region', { name: 'Tomorrow', exact: true });
  await expect(tomorrow.getByRole('button', { name: title, exact: true })).toBeVisible();
  await expect(tomorrow.getByRole('button', { name: new RegExp(`^${title}( earlier)?$`) })).toHaveText([anchor, title]);
  await page.reload();
  await tabs.getByRole('tab', { name: 'Tomorrow', exact: true }).click();
  await expect(tomorrow.getByRole('button', { name: title, exact: true })).toBeVisible();
});
