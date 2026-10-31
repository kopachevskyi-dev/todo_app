import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.js';
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
let instant = '2026-10-31T22:30:00Z';
async function start() {
  server = createApp({ pool, clock: { now: () => new Date(instant), timezone: 'Europe/Warsaw' } }).listen(0, '127.0.0.1');
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

test('single midnight copies unfinished tasks once with note, priority and Not done date; Tomorrow becomes Today', async () => {
  const task = await (await api('/tasks', 'POST', { title: 'Finish report', placement: '2026-10-31', note: 'Keep context', priority: 'high' })).json();
  const tomorrow = await (await api('/tasks', 'POST', { title: 'Next day', placement: '2026-11-01' })).json();
  instant = '2026-10-31T23:01:00Z';
  const plan = await (await api('/plan')).json();
  assert.equal(plan.today.date, '2026-11-01');
  assert.deepEqual(plan.today.tasks.map((t: { id: string }) => t.id), [tomorrow.id]);
  assert.equal(plan.backlog.length, 1);
  const copy = plan.backlog[0];
  assert.notEqual(copy.id, task.id);
  assert.equal(copy.title, 'Finish report');
  assert.equal(copy.note, 'Keep context');
  assert.equal(copy.priority, 'high');
  assert.equal(copy.notDoneFrom, '2026-10-31');
  assert.equal(copy.status, 'open');
  assert.equal(copy.completedAt, null);
  assert.deepEqual(await (await api('/plan')).json(), plan);
});

test('past Day keeps done and not_done tasks and rejects edits, moves, status changes, deletes and restore', async () => {
  instant = '2026-11-01T12:00:00Z';
  const done = await (await api('/tasks', 'POST', { title: 'Completed', placement: '2026-11-01' })).json();
  await api(`/tasks/${done.id}`, 'PATCH', { status: 'done' });
  const open = await (await api('/tasks', 'POST', { title: 'Unfinished', placement: '2026-11-01' })).json();
  const deleted = await (await api('/tasks', 'POST', { title: 'Deleted', placement: '2026-11-01' })).json();
  await api(`/tasks/${deleted.id}`, 'DELETE');
  instant = '2026-11-01T23:01:00Z';
  const response = await api('/days/2026-11-01');
  assert.equal(response.status, 200);
  const day = await response.json();
  assert.equal(day.tasks.find((t: { id: string }) => t.id === done.id).status, 'done');
  assert.equal(day.tasks.find((t: { id: string }) => t.id === open.id).status, 'not_done');
  assert.equal(day.tasks.some((t: { id: string }) => t.id === deleted.id), false);
  for (const task of [open, done]) {
    for (const body of [{ title: 'Changed' }, { note: 'Changed' }, { priority: 'low' }, { placement: 'backlog' }, { status: 'open' }, { status: 'done' }]) {
      assert.equal((await api(`/tasks/${task.id}`, 'PATCH', body)).status, 409);
    }
    assert.equal((await api(`/tasks/${task.id}/move`, 'POST', { placement: 'backlog' })).status, 409);
    assert.equal((await api(`/tasks/${task.id}`, 'DELETE')).status, 409);
    assert.equal((await api(`/tasks/${task.id}/restore`, 'POST')).status, 409);
  }
  assert.equal((await api(`/tasks/${deleted.id}/restore`, 'POST')).status, 409);
  assert.deepEqual(await (await api('/days/2026-11-01')).json(), day);
});

test('replanning an unfinished copy gives it the newer Not done date', async () => {
  instant = '2026-11-02T12:00:00Z';
  const plan = await (await api('/plan')).json();
  const copy = plan.backlog.find((t: { title: string }) => t.title === 'Finish report');
  const moved = await api(`/tasks/${copy.id}/move`, 'POST', { placement: '2026-11-02' });
  assert.equal(moved.status, 200);
  assert.equal((await moved.json()).notDoneFrom, null);
  instant = '2026-11-02T23:01:00Z';
  const next = await (await api('/plan')).json();
  const latest = next.backlog.filter((t: { title: string }) => t.title === 'Finish report');
  assert.equal(latest.length, 1);
  assert.equal(latest[0].notDoneFrom, '2026-11-02');
  assert.notEqual(latest[0].id, copy.id);
  assert.equal(latest[0].note, 'Keep context');
  assert.equal(latest[0].priority, 'high');
  assert.equal((await (await api('/days/2026-11-02')).json()).tasks.find((t: { id: string }) => t.id === copy.id).status, 'not_done');
});

test('server startup catches several missed days before the first request, even with concurrent reads', async () => {
  instant = '2026-11-04T12:00:00Z';
  const first = await (await api('/tasks', 'POST', { title: 'Missed first day', placement: '2026-11-04' })).json();
  const second = await (await api('/tasks', 'POST', { title: 'Missed second day', placement: '2026-11-05' })).json();
  await new Promise<void>(resolve => server.close(() => resolve()));
  instant = '2026-11-09T12:00:00Z';
  const directory = await mkdtemp(join(tmpdir(), 'planner-rollover-'));
  try {
    // An existing daily backup keeps this test focused on startup rollover.
    await writeFile(join(directory, '2026-11-09.dump'), 'existing backup');
    server = await startServer({ pool, clock: { now: () => new Date(instant), timezone: 'Europe/Warsaw' }, backupsDirectory: directory });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
    // Move back before requesting: only startup could have closed these tasks.
    instant = '2026-11-04T12:00:00Z';
    const day = await (await api('/days/2026-11-04')).json();
    assert.equal(day.tasks.find((t: { id: string }) => t.id === first.id).status, 'not_done');
    assert.equal((await (await api('/days/2026-11-05')).json()).tasks.find((t: { id: string }) => t.id === second.id).status, 'not_done');
    instant = '2026-11-09T12:00:00Z';
    const plans = await Promise.all(Array.from({ length: 8 }, async () => (await api('/plan')).json()));
    for (const plan of plans) {
      assert.equal(plan.backlog.filter((t: { title: string }) => t.title === 'Missed first day').length, 1);
      assert.equal(plan.backlog.filter((t: { title: string }) => t.title === 'Missed second day').length, 1);
      assert.equal(plan.backlog.find((t: { title: string }) => t.title === 'Missed first day').notDoneFrom, '2026-11-04');
      assert.equal(plan.backlog.find((t: { title: string }) => t.title === 'Missed second day').notDoneFrom, '2026-11-05');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the Backlog copy of an unfinished task keeps its tags, and the closed Day keeps them too', async () => {
  const tags = await (await api('/tags')).json();
  const [work, home] = [tags.find((t: { name: string }) => t.name === 'work'), tags.find((t: { name: string }) => t.name === 'home')];
  const today = (await (await api('/plan')).json()).today.date;
  const task = await (await api('/tasks', 'POST', { title: 'Tagged leftover', placement: today, priority: 'low' })).json();
  assert.equal((await api(`/tasks/${task.id}`, 'PATCH', { tagIds: [work.id, home.id] })).status, 200);
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  instant = `${next.toISOString().slice(0, 10)}T12:00:00Z`;
  const plan = await (await api('/plan')).json();
  const copy = plan.backlog.find((t: { title: string; notDoneFrom: string }) => t.title === 'Tagged leftover' && t.notDoneFrom === today);
  assert.ok(copy, 'Backlog copy exists');
  assert.equal(copy.priority, 'low');
  assert.deepEqual(copy.tags.map((t: { name: string }) => t.name).sort(), ['home', 'work']);
  const day = await (await api(`/days/${today}`)).json();
  const original = day.tasks.find((t: { id: string }) => t.id === task.id);
  assert.equal(original.status, 'not_done');
  assert.deepEqual(original.tags.map((t: { name: string }) => t.name).sort(), ['home', 'work']);
  assert.deepEqual(await (await api('/plan')).json(), plan);
});
