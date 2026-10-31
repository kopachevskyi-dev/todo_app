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
async function start() {
  server = createApp({ pool, clock: { now: () => new Date('2026-10-31T23:30:00Z'), timezone: 'Europe/Warsaw' } }).listen(0, '127.0.0.1');
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

test('moves between every placement and reorders Days with consistent positions after reload', async () => {
  const create = async (title: string, placement = 'backlog') => (await (await api('/tasks', 'POST', { title, placement })).json());
  const move = async (id: string, placement: string, position?: number) => {
    const response = await api(`/tasks/${id}/move`, 'POST', { placement, ...(position === undefined ? {} : { position }) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const a = await create('A', '2026-11-01');
  const b = await create('B', '2026-11-01');
  const c = await create('C');
  await move(c.id, '2026-11-01', 1);
  let plan = await (await api('/plan')).json();
  assert.deepEqual(plan.today.tasks.map((t: { title: string }) => t.title), ['A', 'C', 'B']);
  await move(b.id, '2026-11-01', 0);
  await move(a.id, '2026-11-02', 0);
  await move(c.id, '2026-11-02');
  await move(a.id, '2026-11-02', 1);
  await move(b.id, 'backlog');
  await move(b.id, '2026-11-02', 1);
  await move(c.id, 'backlog');
  await move(c.id, '2026-11-01');
  await move(a.id, '2026-11-01', 0);
  await new Promise<void>(resolve => server.close(() => resolve()));
  await start();
  plan = await (await api('/plan')).json();
  assert.deepEqual(plan.today.tasks.map((t: { title: string }) => t.title), ['A', 'C']);
  assert.deepEqual(plan.today.tasks.map((t: { position: number }) => t.position), [0, 1]);
  assert.deepEqual(plan.tomorrow.tasks.map((t: { title: string }) => t.title), ['B']);
  assert.deepEqual(plan.tomorrow.tasks.map((t: { position: number }) => t.position), [0]);
});

test('checking a Backlog task moves it to Today as done and preserves its details', async () => {
  const task = await (await api('/tasks', 'POST', { title: 'Unplanned work', placement: 'backlog', note: 'Context', priority: 'high' })).json();
  const response = await api(`/tasks/${task.id}`, 'PATCH', { status: 'done' });
  assert.equal(response.status, 200);
  const done = await response.json();
  assert.equal(done.placement, '2026-11-01');
  assert.equal(done.status, 'done');
  assert.equal(done.completedAt, '2026-10-31T23:30:00.000Z');
  assert.equal(done.note, 'Context');
  assert.equal(done.priority, 'high');
  const plan = await (await api('/plan')).json();
  assert.equal(plan.backlog.some((t: { id: string }) => t.id === task.id), false);
  assert.equal(plan.today.tasks.at(-1).id, task.id);
  const reopened = await (await api(`/tasks/${task.id}`, 'PATCH', { status: 'open' })).json();
  assert.equal(reopened.placement, '2026-11-01');
  assert.equal(reopened.completedAt, null);
});

test('move validates placement and position, rejects missing tasks and keeps Backlog priority order', async () => {
  const task = await (await api('/tasks', 'POST', { title: 'Validate move', placement: 'backlog' })).json();
  for (const body of [{ placement: 'yesterday' }, { placement: ['backlog'] }, { placement: '2026-10-31' }, ...[-1, 1.5, '1', null].map(position => ({ placement: '2026-11-01', position }))]) {
    assert.equal((await api(`/tasks/${task.id}/move`, 'POST', body)).status, 400);
  }
  assert.equal((await api('/tasks/missing/move', 'POST', { placement: 'backlog' })).status, 404);
  await api(`/tasks/${task.id}`, 'DELETE');
  assert.equal((await api(`/tasks/${task.id}/move`, 'POST', { placement: '2026-11-01' })).status, 404);
  const high = await (await api('/tasks', 'POST', { title: 'Important', placement: '2026-11-01', priority: 'high' })).json();
  const low = await (await api('/tasks', 'POST', { title: 'Later', placement: 'backlog', priority: 'low' })).json();
  await api(`/tasks/${high.id}/move`, 'POST', { placement: 'backlog', position: 99 });
  const plan = await (await api('/plan')).json();
  assert.deepEqual(plan.backlog.filter((t: { id: string }) => [high.id, low.id].includes(t.id)).map((t: { id: string }) => t.id), [high.id, low.id]);
});
