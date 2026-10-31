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
let now = new Date('2026-10-30T12:00:00Z');
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

test('Today reflection autosaves after typing and survives reload', async ({ page }) => {
  await page.goto(base);
  const reflection = page.getByRole('textbox', { name: 'Reflection', exact: true });
  await reflection.fill('Finished the hard thing. Leave room tomorrow.');
  await expect(page.getByRole('status', { name: 'Reflection save status' })).toHaveText('Saved');
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('tab', { name: 'Plan', exact: true }).click();
  await expect(reflection).toHaveValue('Finished the hard thing. Leave room tomorrow.');
  await page.reload();
  await expect(reflection).toHaveValue('Finished the hard thing. Leave room tomorrow.');
  for (const name of ['Today', 'Tomorrow']) await expect(page.getByRole('region', { name, exact: true })).toContainText('0 of 0 done');
});

test('reloading within the debounce window keeps the pending reflection', async ({ page }) => {
  await page.goto(base);
  const editor = page.getByRole('textbox', { name: 'Reflection', exact: true });
  await editor.fill('Saved even when I reload immediately.');
  await page.reload();
  await expect(editor).toHaveValue('Saved even when I reload immediately.');
});

test('yesterday banner disappears after dismissing or writing inline and stays gone on reload', async ({ page, request }) => {
  // Create tasks through the API on their actual day, then advance the injected clock.
  const cleared = await request.put(`${apiBase}/api/days/2026-10-30`, { data: { reflection: ' \n\t ' } });
  expect((await cleared.json()).reflection).toBe('');
  expect((await (await request.get(`${apiBase}/api/days/2026-10-30`)).json()).reflection).toBe('');
  await request.post(`${apiBase}/api/tasks`, { data: { title: 'Work to reflect on', placement: '2026-10-30' } });
  now = new Date('2026-10-31T12:00:00Z');
  await page.goto(base);
  const banner = page.getByRole('region', { name: 'Reflect on yesterday' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Dismiss' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await request.post(`${apiBase}/api/tasks`, { data: { title: 'Another day', placement: '2026-10-31' } });
  now = new Date('2026-11-01T12:00:00Z');
  await page.reload();
  await expect(banner).toBeVisible();
  const editor = banner.getByRole('textbox', { name: "Yesterday's reflection" });
  await editor.fill('A useful lesson');
  await expect(banner.getByRole('status')).toHaveText('Saved');
  await expect(editor).toBeFocused();
  await editor.press('End');
  await editor.pressSequentially(' for tomorrow.');
  await expect(banner.getByRole('status')).toHaveText('Saved');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('A useful lesson for tomorrow.');
  await page.getByRole('heading', { name: 'Plan', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  expect((await (await request.get(`${apiBase}/api/days/2026-10-31`)).json()).reflection).toBe('A useful lesson for tomorrow.');
});
