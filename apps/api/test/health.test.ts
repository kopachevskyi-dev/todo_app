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
let baseUrl: string;
let instant = new Date('2026-10-31T22:59:00Z');

before(async () => {
  container = docker('run', '-d', '--rm', '-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_DB=planner_test', '-p', '127.0.0.1::5432', 'postgres:17-alpine');
  const port = docker('port', container, '5432/tcp').split(':').at(-1);
  pool = new Pool({ connectionString: `postgres://postgres:test@127.0.0.1:${port}/planner_test` });
  for (let attempt = 0; ; attempt++) {
    try { await pool.query('SELECT 1'); break; }
    catch (error) { if (attempt >= 60) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  await migrate(pool);
  const app = createApp({ pool, clock: { now: () => instant, timezone: 'Europe/Warsaw' } });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (pool) await pool.end();
  if (container) docker('stop', container);
});

test('health reports server and migrated database readiness through HTTP', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { server: 'ready', database: 'ready', now: '2026-10-31T22:59:00.000Z', timezone: 'Europe/Warsaw' });
});

test('API harness can move the injected clock across midnight', async () => {
  instant = new Date('2026-11-01T00:05:00Z');
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal((await response.json()).now, '2026-11-01T00:05:00.000Z');
});

test('reapplying startup migrations keeps the HTTP API ready', async () => {
  await migrate(pool);
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
});

test('health returns unavailable when the database is not reachable', async () => {
  docker('stop', container);
  container = '';
  pool.on('error', () => {});
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { server: 'ready', database: 'unavailable' });
});
