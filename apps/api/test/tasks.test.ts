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

test('create in each placement uses server timezone and rejects invalid titles and placements', async () => {
  const plan = await (await api('/plan')).json();
  assert.equal(plan.today.date, '2026-11-01');
  assert.equal(plan.tomorrow.date, '2026-11-02');
  for (const placement of ['backlog', plan.today.date, plan.tomorrow.date]) {
    const response = await api('/tasks', 'POST', { title: '  A task  ', placement });
    assert.equal(response.status, 201);
    const task = await response.json();
    assert.equal(task.title, 'A task');
    assert.equal(task.placement, placement);
    assert.equal(task.status, 'open');
    assert.equal(task.completedAt, null);
  }
  for (const title of ['', '  ', null, 12]) assert.equal((await api('/tasks', 'POST', { title, placement: 'backlog' })).status, 400);
  assert.equal((await api('/tasks', 'POST', { title: 'No', placement: '2026-12-01' })).status, 400);
  for (const body of [{ placement: ['backlog'] }, { priority: ['high'] }]) assert.equal((await api('/tasks', 'POST', { title: 'Invalid', placement: 'backlog', ...body })).status, 400);
});

test('update fields and done/undone persist through restart; unknown ids return 404', async () => {
  const task = await (await api('/tasks', 'POST', { title: 'Edit me', placement: '2026-11-01' })).json();
  const updated = await api(`/tasks/${task.id}`, 'PATCH', { title: ' Edited ', note: 'Context', priority: 'high', status: 'done' });
  assert.equal(updated.status, 200);
  const done = await updated.json();
  assert.equal(done.completedAt, '2026-10-31T23:30:00.000Z');
  assert.equal(done.title, 'Edited');
  assert.equal(done.note, 'Context');
  assert.equal(done.priority, 'high');
  await new Promise<void>(resolve => server.close(() => resolve()));
  await migrate(pool);
  await start();
  const plan = await (await api('/plan')).json();
  assert.deepEqual(plan.today.tasks.find((item: { id: string }) => item.id === task.id), done);
  const reopened = await (await api(`/tasks/${task.id}`, 'PATCH', { status: 'open', note: null, priority: null })).json();
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.note, null);
  assert.equal(reopened.priority, null);
  for (const body of [{ title: ' ' }, { priority: 'urgent' }, { status: 'not_done' }, { note: 4 }, { placement: 'backlog' }, { priority: ['high'] }, { status: ['done'] }]) assert.equal((await api(`/tasks/${task.id}`, 'PATCH', body)).status, 400);
  for (const [path, method] of [['/tasks/unknown', 'PATCH'], ['/tasks/unknown', 'DELETE'], ['/tasks/unknown/restore', 'POST']]) assert.equal((await api(path, method, method === 'PATCH' ? { title: 'X' } : undefined)).status, 404);
});

test('Days order by position with done last; soft delete and restore keep position', async () => {
  const create = async (title: string) => (await api('/tasks', 'POST', { title, placement: '2026-11-02' })).json();
  const first = await create('First');
  const second = await create('Second');
  const third = await create('Third');
  await api(`/tasks/${first.id}`, 'PATCH', { status: 'done' });
  const ids = async () => (await (await api('/plan')).json()).tomorrow.tasks.filter((t: { id: string }) => [first.id, second.id, third.id].includes(t.id)).map((t: { id: string }) => t.id);
  assert.deepEqual(await ids(), [second.id, third.id, first.id]);
  assert.equal((await api(`/tasks/${second.id}`, 'DELETE')).status, 200);
  assert.deepEqual(await ids(), [third.id, first.id]);
  await new Promise<void>(resolve => server.close(() => resolve()));
  await start();
  assert.deepEqual(await ids(), [third.id, first.id]);
  assert.equal((await api(`/tasks/${second.id}`, 'PATCH', { title: 'Deleted' })).status, 404);
  assert.equal((await api(`/tasks/${second.id}/restore`, 'POST')).status, 200);
  assert.deepEqual(await ids(), [second.id, third.id, first.id]);
  await new Promise<void>(resolve => server.close(() => resolve()));
  await start();
  assert.deepEqual(await ids(), [second.id, third.id, first.id]);
  await api(`/tasks/${first.id}`, 'PATCH', { status: 'open' });
  assert.deepEqual(await ids(), [first.id, second.id, third.id]);
});

test('Backlog orders high, medium, low, none and newest first within priority', async () => {
  const tasks: { id: string }[] = [];
  for (const priority of [null, 'low', 'high', 'medium', 'high']) tasks.push(await (await api('/tasks', 'POST', { title: `Priority ${priority}`, priority, placement: 'backlog' })).json());
  const plan = await (await api('/plan')).json();
  assert.deepEqual(plan.backlog.filter((t: { id: string }) => tasks.some(task => task.id === t.id)).map((t: { id: string }) => t.id), [tasks[4].id, tasks[2].id, tasks[3].id, tasks[1].id, tasks[0].id]);
});
