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
let now = new Date('2026-10-31T23:30:00Z');
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

test('today and past reflections are readable, editable and survive server restart', async () => {
  for (const date of ['2026-11-01', '2026-10-15']) {
    assert.equal((await api(`/days/${date}`, 'PUT', { reflection: 'What went well\nWhat to change' })).status, 200);
    assert.equal((await (await api(`/days/${date}`)).json()).reflection, 'What went well\nWhat to change');
  }
  await new Promise<void>(resolve => server.close(() => resolve()));
  await start();
  assert.equal((await (await api('/days/2026-10-15')).json()).reflection, 'What went well\nWhat to change');
  assert.equal((await api('/days/2026-10-15', 'PUT', { reflection: 'New conclusion' })).status, 200);
  assert.equal((await (await api('/days/2026-10-15')).json()).reflection, 'New conclusion');
  assert.equal((await (await api('/plan')).json()).today.reflection, 'What went well\nWhat to change');
});

test('empty and whitespace-only reflections read as empty, while dismissal is preserved', async () => {
  for (const date of ['2026-10-14', '2026-10-15']) {
    for (const reflection of ['', ' \n\t ']) {
      const response = await api(`/days/${date}`, 'PUT', { reflection });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).reflection, '');
      const day = await (await api(`/days/${date}`)).json();
      assert.equal(day.reflection, '');
      assert.equal(day.reflectionPromptDismissed, false);
    }
  }
  await api('/days/2026-10-13/dismiss-prompt', 'POST');
  await api('/days/2026-10-13', 'PUT', { reflection: ' \t ' });
  const dismissed = await (await api('/days/2026-10-13')).json();
  assert.equal(dismissed.reflection, '');
  assert.equal(dismissed.reflectionPromptDismissed, true);
});

test('yesterday prompt needs tasks, an empty reflection and no dismissal; dismissal survives restart', async () => {
  now = new Date('2026-11-03T12:00:00Z');
  let plan = await (await api('/plan')).json();
  assert.equal(plan.yesterday.date, '2026-11-02');
  assert.equal(plan.yesterday.showReflectionPrompt, false);
  await api('/tasks', 'POST', { title: 'Yesterday work', placement: '2026-11-03' });
  now = new Date('2026-11-04T12:00:00Z');
  plan = await (await api('/plan')).json();
  assert.equal(plan.yesterday.showReflectionPrompt, true);
  await api('/days/2026-11-03', 'PUT', { reflection: 'Useful day' });
  assert.equal((await (await api('/plan')).json()).yesterday.showReflectionPrompt, false);
  await api('/days/2026-11-03', 'PUT', { reflection: '   ' });
  assert.equal((await (await api('/plan')).json()).yesterday.showReflectionPrompt, true);
  assert.equal((await api('/days/2026-11-03/dismiss-prompt', 'POST')).status, 200);
  await new Promise<void>(resolve => server.close(() => resolve()));
  await start();
  assert.equal((await (await api('/plan')).json()).yesterday.showReflectionPrompt, false);
  assert.equal((await (await api('/days/2026-11-03')).json()).reflectionPromptDismissed, true);
  await api('/days/2026-11-03', 'PUT', { reflection: 'Late conclusion' });
  assert.equal((await (await api('/days/2026-11-03')).json()).reflectionPromptDismissed, true);
});

test('day counts include done tasks and exclude deleted tasks in Today and Tomorrow', async () => {
  for (const placement of ['2026-11-04', '2026-11-05']) {
    const tasks = [];
    for (const title of ['Open', 'Done', 'Deleted']) tasks.push(await (await api('/tasks', 'POST', { title, placement })).json());
    await api(`/tasks/${tasks[1].id}`, 'PATCH', { status: 'done' });
    await api(`/tasks/${tasks[2].id}`, 'DELETE');
  }
  const plan = await (await api('/plan')).json();
  assert.equal(plan.today.done, 1);
  assert.equal(plan.today.total, 2);
  assert.equal(plan.tomorrow.done, 1);
  assert.equal(plan.tomorrow.total, 2);
});

test('invalid dates, future dates and non-text reflections return readable validation errors', async () => {
  for (const date of ['2026-02-30', 'invalid', '2026-11-05']) {
    for (const method of ['GET', 'PUT', 'POST']) {
      const response = await api(`/days/${date}${method === 'POST' ? '/dismiss-prompt' : ''}`, method, method === 'PUT' ? { reflection: 'No' } : undefined);
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).message, 'string');
    }
  }
  for (const body of [{}, { reflection: null }, { reflection: 4 }, { reflection: 'Yes', extra: true }, ['wrong']]) {
    assert.equal((await api('/days/2026-11-04', 'PUT', body)).status, 400);
  }
});
