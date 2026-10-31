import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { migrate } from '../src/migrate.js';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
let container: string;
let pool: Pool;
let server: Server;
let base: string;
let now = new Date('2026-09-30T12:00:00Z');
async function start() {
  server = createApp({ pool, clock: { now: () => now, timezone: 'Europe/Warsaw' } }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  base = `http://127.0.0.1:${address.port}`;
}
async function api(path: string, method = 'GET', body?: unknown) {
  return fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
before(async () => {
  container = docker('run', '-d', '--rm', '-e', 'POSTGRES_PASSWORD=test', '-p', '127.0.0.1::5432', 'postgres:17-alpine');
  const port = docker('port', container, '5432/tcp').split(':').at(-1);
  pool = new Pool({ connectionString: `postgres://postgres:test@127.0.0.1:${port}/postgres` });
  for (let i = 0; ; i++) {
    try { await pool.query('SELECT 1'); break; } catch (error) { if (i === 60) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  await migrate(pool);
  await start();
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (pool) await pool.end();
  if (container) docker('stop', container);
});

test('month summary counts done and not_done, excludes deleted tasks and respects month boundaries', async () => {
  for (const date of ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01']) {
    now = new Date(`${date}T12:00:00Z`);
    for (const title of ['Done', 'Unfinished', 'Deleted']) {
      const created = await api('/tasks', 'POST', { title, placement: date });
      assert.equal(created.status, 201);
      const task = await created.json();
      if (title === 'Done') await api(`/tasks/${task.id}`, 'PATCH', { status: 'done' });
      if (title === 'Deleted') await api(`/tasks/${task.id}`, 'DELETE');
    }
  }
  now = new Date('2026-11-02T12:00:00Z');
  const response = await api('/history?month=2026-10');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { month: '2026-10', days: [
    { date: '2026-10-01', total: 2, done: 1 },
    { date: '2026-10-31', total: 2, done: 1 },
  ] });
  assert.deepEqual((await (await api('/history?month=2026-09')).json()).days, [{ date: '2026-09-30', total: 2, done: 1 }]);
  assert.deepEqual((await (await api('/history?month=2026-11')).json()).days, [{ date: '2026-11-01', total: 2, done: 1 }]);
  assert.deepEqual((await (await api('/history?month=2026-02')).json()).days, []);
});

test('Day detail includes done and not_done tasks, counts and an editable reflection, excluding deleted tasks', async () => {
  const response = await api('/days/2026-10-31');
  assert.equal(response.status, 200);
  const day = await response.json();
  assert.equal(day.date, '2026-10-31');
  assert.equal(day.total, 2);
  assert.equal(day.done, 1);
  assert.deepEqual(day.tasks.map((task: { title: string; status: string }) => ({ title: task.title, status: task.status })), [
    { title: 'Done', status: 'done' }, { title: 'Unfinished', status: 'not_done' },
  ]);
  assert.equal(day.reflection, '');
  assert.equal((await api('/days/2026-10-31', 'PUT', { reflection: 'A late conclusion' })).status, 200);
  await new Promise<void>(resolve => server.close(() => resolve()));
  await start();
  assert.deepEqual(await (await api('/days/2026-10-31')).json(), { ...day, reflection: 'A late conclusion', showReflectionPrompt: false });
  const empty = await (await api('/days/2026-10-15')).json();
  assert.equal(empty.total, 0);
  assert.equal(empty.done, 0);
  assert.deepEqual(empty.tasks, []);
  assert.equal(empty.reflection, '');
});

test('invalid or missing history months return a readable validation error', async () => {
  for (const query of ['', '?month=2026-13', '?month=2026-00', '?month=0000-01', '?month=2026-1', '?month=invalid', '?month=2026-10-01', '?month=2026-10&month=2026-11']) {
    const response = await api(`/history${query}`);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).message, 'string');
  }
});
