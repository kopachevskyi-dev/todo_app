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

test('fresh database seeds work, private and home tags', async () => {
  const response = await api('/tags');
  assert.equal(response.status, 200);
  const tags = await response.json();
  assert.deepEqual(tags.map((tag: { name: string }) => tag.name).sort(), ['home', 'private', 'work']);
  for (const tag of tags) { assert.ok(tag.id); assert.match(tag.color, /^#[0-9a-f]{6}$/i); }
});

test('create, rename and recolor tags; case-insensitive names are unique', async () => {
  const created = await api('/tags', 'POST', { name: '  Errands  ', color: '#123456' });
  assert.equal(created.status, 201);
  const tag = await created.json();
  assert.equal(tag.name, 'Errands');
  const duplicate = await api('/tags', 'POST', { name: 'WORK', color: '#123456' });
  assert.equal(duplicate.status, 400);
  assert.match((await duplicate.json()).message, /already exists/i);
  const conflict = await api(`/tags/${tag.id}`, 'PATCH', { name: 'PRIVATE' });
  assert.equal(conflict.status, 400);
  const edited = await api(`/tags/${tag.id}`, 'PATCH', { name: 'Trips', color: '#abcdef' });
  assert.equal(edited.status, 200);
  assert.deepEqual(await edited.json(), { id: tag.id, name: 'Trips', color: '#abcdef' });
  for (const body of [{ name: ' ' }, { name: 4 }, { color: 'red' }, { extra: true }, null]) {
    assert.equal((await api(`/tags/${tag.id}`, 'PATCH', body)).status, 400);
  }
  for (const method of ['PATCH', 'DELETE']) assert.equal((await api('/tags/unknown', method, method === 'PATCH' ? { name: 'Unknown' } : undefined)).status, 404);
});

test('tasks attach several tags, replace and detach them; invalid tag ids leave tasks unchanged', async () => {
  const tags = await (await api('/tags')).json();
  const task = await (await api('/tasks', 'POST', { title: 'Tagged task', placement: 'backlog' })).json();
  const tagIds = tags.slice(0, 2).map((tag: { id: string }) => tag.id);
  const attached = await api(`/tasks/${task.id}`, 'PATCH', { tagIds });
  assert.equal(attached.status, 200);
  assert.deepEqual((await attached.json()).tags.map((tag: { id: string }) => tag.id).sort(), [...tagIds].sort());
  const plan = await (await api('/plan')).json();
  assert.equal(plan.backlog.find((t: { id: string }) => t.id === task.id).tags.length, 2);
  for (const ids of [['unknown'], [12], null, [tagIds[0], tagIds[0]], ['00000000-0000-0000-0000-000000000000']]) {
    assert.equal((await api(`/tasks/${task.id}`, 'PATCH', { title: 'Should not change', tagIds: ids })).status, 400);
  }
  const unchanged = (await (await api('/plan')).json()).backlog.find((t: { id: string }) => t.id === task.id);
  assert.equal(unchanged.title, 'Tagged task');
  assert.equal(unchanged.tags.length, 2);
  const replaced = await (await api(`/tasks/${task.id}`, 'PATCH', { tagIds: [tagIds[0]] })).json();
  assert.equal(replaced.tags.length, 1);
  const detached = await (await api(`/tasks/${task.id}`, 'PATCH', { tagIds: [] })).json();
  assert.deepEqual(detached.tags, []);
});

test('deleting a tag removes links from every task including restored tasks', async () => {
  const tag = await (await api('/tags', 'POST', { name: 'Temporary', color: '#112233' })).json();
  const tasks: { id: string }[] = [];
  for (const placement of ['backlog', '2026-11-01']) {
    const task = await (await api('/tasks', 'POST', { title: 'Delete tag links', placement })).json();
    await api(`/tasks/${task.id}`, 'PATCH', { tagIds: [tag.id] });
    tasks.push(task);
  }
  await api(`/tasks/${tasks[0].id}`, 'DELETE');
  assert.equal((await api(`/tags/${tag.id}`, 'DELETE')).status, 200);
  const restored = await (await api(`/tasks/${tasks[0].id}/restore`, 'POST')).json();
  assert.deepEqual(restored.tags, []);
  const plan = await (await api('/plan')).json();
  assert.deepEqual(plan.today.tasks.find((t: { id: string }) => t.id === tasks[1].id).tags, []);
  assert.ok(!(await (await api('/tags')).json()).some((t: { id: string }) => t.id === tag.id));
});

test('Backlog tag filter returns only matching tasks and leaves Days unfiltered', async () => {
  const tag = await (await api('/tags', 'POST', { name: 'Filter', color: '#112233' })).json();
  const tasks: { id: string }[] = [];
  for (const placement of ['backlog', 'backlog', '2026-11-01', '2026-11-02']) tasks.push(await (await api('/tasks', 'POST', { title: 'Filter task', placement })).json());
  await api(`/tasks/${tasks[0].id}`, 'PATCH', { tagIds: [tag.id] });
  const plan = await (await api(`/plan?tagId=${tag.id}`)).json();
  assert.deepEqual(plan.backlog.map((t: { id: string }) => t.id), [tasks[0].id]);
  assert.ok(plan.today.tasks.some((t: { id: string }) => t.id === tasks[2].id));
  assert.ok(plan.tomorrow.tasks.some((t: { id: string }) => t.id === tasks[3].id));
  assert.deepEqual((await (await api('/plan?tagId=unknown')).json()).backlog, []);
});
