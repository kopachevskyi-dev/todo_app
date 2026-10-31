import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from '../../apps/api/src/app.js';
import { migrate } from '../../apps/api/src/migrate.js';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
let container: string;
let pool: Pool;
let server: Server;
let base: string;
let apiBase: string;
let now = new Date('2026-10-31T12:00:00Z');
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  execFileSync('npm', ['run', 'build', '--workspace', 'apps/web'], { stdio: 'pipe' });
  container = docker('run', '-d', '--rm', '-e', 'POSTGRES_PASSWORD=test', '-p', '127.0.0.1::5432', 'postgres:17-alpine');
  const port = docker('port', container, '5432/tcp').split(':').at(-1);
  pool = new Pool({ connectionString: `postgres://postgres:test@127.0.0.1:${port}/postgres` });
  for (let i = 0; ; i++) {
    try { await pool.query('SELECT 1'); break; } catch (error) { if (i === 60) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  await migrate(pool);
  server = createApp({ pool, clock: { now: () => now, timezone: 'Europe/Warsaw' }, webDirectory: fileURLToPath(new URL('../../apps/web/dist/', import.meta.url)) }).listen(0, '0.0.0.0');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  apiBase = `http://127.0.0.1:${address.port}`;
  base = `http://${process.env.PLAYWRIGHT_WS_ENDPOINT ? 'host.docker.internal' : '127.0.0.1'}:${address.port}`;
});
test.afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (pool) await pool.end();
  if (container) docker('stop', container);
});

test('History navigates Monday-first months, shades past days, and opens read-only tasks with an editable reflection', async ({ page, request }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  for (const title of ['Finished report', 'Unfinished call', 'Deleted task']) {
    const created = await request.post(`${apiBase}/api/tasks`, { data: { title, placement: '2026-10-31' } });
    expect(created.status()).toBe(201);
    const task = await created.json();
    if (title === 'Finished report') await request.patch(`${apiBase}/api/tasks/${task.id}`, { data: { status: 'done' } });
    if (title === 'Deleted task') await request.delete(`${apiBase}/api/tasks/${task.id}`);
  }
  await request.put(`${apiBase}/api/days/2026-10-31`, { data: { reflection: 'An honest day.' } });
  now = new Date('2026-11-01T12:00:00Z');
  await page.goto(base);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  const calendar = page.getByRole('table', { name: 'November 2026' });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByRole('columnheader')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  await expect(calendar.getByRole('row').nth(1).getByRole('cell').nth(6).getByRole('button')).toHaveAccessibleName('2026-11-01, 0 of 0 done');
  await expect(page.getByRole('button', { name: '2026-11-01, 0 of 0 done', exact: true })).toHaveAttribute('aria-current', 'date');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('table', { name: 'October 2026' })).toBeVisible();
  const pastDay = page.getByRole('button', { name: '2026-10-31, 1 of 2 done', exact: true });
  const emptyDay = page.getByRole('button', { name: '2026-10-30, 0 of 0 done', exact: true });
  await expect(emptyDay).toHaveCSS('background-color', 'rgb(244, 244, 242)');
  const emptyBackground = await emptyDay.evaluate(element => getComputedStyle(element).backgroundColor);
  await expect(pastDay).not.toHaveCSS('background-color', emptyBackground);
  await pastDay.click();
  const panel = page.getByRole('dialog', { name: 'Day details' });
  await expect(panel).toContainText('2026-10-31');
  await expect(panel).toContainText('1 of 2 done');
  await expect(panel.getByRole('listitem')).toHaveText(['Finished reportDone', 'Unfinished callNot done']);
  await expect(panel.getByRole('checkbox')).toHaveCount(0);
  await expect(panel.getByText('Deleted task')).toHaveCount(0);
  await expect(panel.getByRole('textbox', { name: 'Reflection', exact: true })).toHaveValue('An honest day.');
  await panel.getByRole('textbox', { name: 'Reflection', exact: true }).fill('A useful conclusion for next month.');
  await expect(panel.getByRole('status', { name: 'Reflection save status' })).toHaveText('Saved');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(pastDay).toBeFocused();
  await pastDay.click();
  await expect(panel.getByRole('textbox', { name: 'Reflection', exact: true })).toHaveValue('A useful conclusion for next month.');
  await panel.getByRole('button', { name: 'Close day details' }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('table', { name: 'September 2026' })).toBeVisible();
  await expect(page.getByText('Your past days will appear here.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('table', { name: 'October 2026' })).toBeVisible();
  expect((await (await request.get(`${apiBase}/api/days/2026-10-31`)).json()).reflection).toBe('A useful conclusion for next month.');
});


test('returning to Plan after reflecting in History removes the stale yesterday banner without overwriting the saved text', async ({ page, request }) => {
  now = new Date('2026-11-02T12:00:00Z');
  const created = await request.post(`${apiBase}/api/tasks`, { data: { title: 'Yesterday work', placement: '2026-11-02' } });
  expect(created.status()).toBe(201);
  now = new Date('2026-11-03T12:00:00Z');
  await page.goto(base);
  const banner = page.getByRole('region', { name: 'Reflect on yesterday' });
  await expect(banner).toBeVisible();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: '2026-11-02, 0 of 1 done', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Day details' });
  await panel.getByRole('textbox', { name: 'Reflection', exact: true }).fill('A conclusion saved from History.');
  await expect(panel.getByRole('status', { name: 'Reflection save status' })).toHaveText('Saved');
  await panel.getByRole('button', { name: 'Close day details' }).click();
  await page.getByRole('tab', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Today', exact: true })).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Reflection', exact: true }).fill('Today has its own reflection.');
  await expect(page.getByRole('status', { name: 'Reflection save status' })).toHaveText('Saved');
  await page.reload();
  await expect(banner).toHaveCount(0);
  expect((await (await request.get(`${apiBase}/api/days/2026-11-02`)).json()).reflection).toBe('A conclusion saved from History.');
});
