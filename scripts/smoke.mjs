import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const directory = await mkdtemp(join(tmpdir(), 'day-planner-smoke-'));
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const env = { ...process.env, DATA_DIR: directory, APP_PORT: String(port), TZ: '' };
const hostTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const project = `todo-smoke-${process.pid}`;
const compose = (...args) => execFileSync('docker', ['compose', '-f', 'compose.yaml', '-p', project, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const sql = statement => compose('exec', '-T', 'db', 'psql', '-U', 'planner', '-d', 'planner', '-Atc', statement);
async function ready() {
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { connection: 'close' } });
      if (response.ok) break;
    } catch { /* The host port may lag the container healthcheck after restart. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(response, 'Health endpoint did not become reachable');
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.database, 'ready');
  const localDate = timezone => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' }).format(new Date(health.now));
  assert.equal(localDate(health.timezone), localDate(hostTimezone), 'default timezone follows the host');
  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>Day Planner<\/title>/);
}
try {
  compose('up', '-d', '--build', '--wait');
  await ready();
  const migration = sql('SELECT version || applied_at::text FROM public.schema_migrations');
  assert.match(migration, /^001_baseline\.sql/);
  const taskResponse = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Survives restart', placement: 'backlog', note: 'Saved context', priority: 'high' }),
  });
  assert.equal(taskResponse.status, 201);
  const task = await taskResponse.json();
  const edited = await fetch(`http://127.0.0.1:${port}/api/tasks/${task.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Edited before restart', priority: 'low' }),
  });
  assert.equal(edited.status, 200);
  const saved = await edited.json();
  compose('down');
  compose('up', '-d', '--wait');
  await ready();
  const plan = await (await fetch(`http://127.0.0.1:${port}/api/plan`)).json();
  assert.deepEqual(plan.backlog.find(item => item.id === task.id), saved);
  assert.equal(sql('SELECT version || applied_at::text FROM public.schema_migrations'), migration);
  console.log('Smoke passed: empty-folder startup, UI, task creation/edit persistence and migration idempotency.');
} finally {
  compose('down', '-v');
  await rm(directory, { recursive: true, force: true });
}
