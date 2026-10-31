import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import { startServer } from '../src/server.js';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
let container: string;
let pool: Pool;
let directory: string;
let databaseUrl: string;
const originalPath = process.env.PATH;
let server: Server | undefined;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'planner-backups-'));
  container = docker('run', '-d', '--rm', '-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_DB=planner_test', '-p', '127.0.0.1::5432', 'postgres:17-alpine');
  const port = docker('port', container, '5432/tcp').split(':').at(-1);
  pool = new Pool({ connectionString: `postgres://postgres:test@127.0.0.1:${port}/planner_test` });
  databaseUrl = 'postgres://postgres:test@127.0.0.1:5432/planner_test';
  for (let attempt = 0; ; attempt++) {
    try { await pool.query('SELECT 1'); break; }
    catch (error) { if (attempt >= 60) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  // Run the real PostgreSQL 17 client in the disposable database container.
  // This avoids requiring a matching pg_dump installation on the developer's Mac.
  const bin = join(directory, 'bin');
  await mkdir(bin);
  await writeFile(join(bin, 'pg_dump'), `#!/bin/sh\nexec docker exec ${container} pg_dump "$@"\n`);
  await chmod(join(bin, 'pg_dump'), 0o700);
  process.env.PATH = `${bin}:${originalPath}`;
});

async function stop() {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  server = undefined;
}

after(async () => {
  await stop();
  process.env.PATH = originalPath;
  if (pool) await pool.end();
  if (container) docker('stop', container);
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function start(instant: string, backupsDirectory: string) {
  await stop();
  server = await startServer({ pool, databaseUrl, backupsDirectory, clock: { now: () => new Date(instant), timezone: 'Europe/Warsaw' } });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/health`)).status, 200);
}

test('first server start backs up the migrated database using the configured timezone date', async () => {
  const backups = join(directory, 'first');
  await start('2026-10-31T23:30:00Z', backups);
  assert.deepEqual(await readdir(backups), ['2026-11-01.dump']);
  const dump = await readFile(join(backups, '2026-11-01.dump'));
  assert.equal(dump.subarray(0, 5).toString(), 'PGDMP');
  const contents = execFileSync('docker', ['exec', '-i', container, 'pg_restore', '--list'], { input: dump, encoding: 'utf8' });
  assert.match(contents, /schema_migrations/);
});

test('restarting on the same local day leaves the existing backup unchanged', async () => {
  const backups = join(directory, 'same-day');
  await start('2026-10-31T23:30:00Z', backups);
  const path = join(backups, '2026-11-01.dump');
  const first = await readFile(path);
  await new Promise(resolve => setTimeout(resolve, 1100));
  await start('2026-11-01T22:30:00Z', backups);
  assert.deepEqual(await readdir(backups), ['2026-11-01.dump']);
  assert.deepEqual(await readFile(path), first);
});

test('starts on four dates leave only the three newest daily backups', async () => {
  const backups = join(directory, 'retention');
  await mkdir(backups);
  await writeFile(join(backups, 'keep.txt'), 'unrelated file');
  // Out-of-order dates prove retention uses calendar dates, not creation order.
  for (const date of ['2026-11-01', '2026-11-04', '2026-11-03', '2026-11-02']) {
    await start(`${date}T12:00:00Z`, backups);
  }
  assert.deepEqual((await readdir(backups)).sort(), ['2026-11-02.dump', '2026-11-03.dump', '2026-11-04.dump', 'keep.txt']);
});

test('failure to write a backup is logged and does not block server startup', async t => {
  const backups = join(directory, 'not-a-directory');
  await writeFile(backups, 'cannot store backups here');
  const log = t.mock.method(console, 'error', () => {});
  await start('2026-11-01T12:00:00Z', backups);
  assert.equal(log.mock.calls.length, 1);
  assert.match(String(log.mock.calls[0].arguments[0]), /backup/i);
});

test('same-day startup prunes older backups while preserving the existing daily backup', async () => {
  const backups = join(directory, 'same-day-retention');
  await mkdir(backups);
  for (const date of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
    await writeFile(join(backups, `${date}.dump`), `existing backup ${date}`);
  }
  await start('2026-11-04T12:00:00Z', backups);
  assert.deepEqual((await readdir(backups)).sort(), ['2026-11-02.dump', '2026-11-03.dump', '2026-11-04.dump']);
  assert.equal(await readFile(join(backups, '2026-11-04.dump'), 'utf8'), 'existing backup 2026-11-04');
});

test('a failed dump leaves no partial backup and the next startup retries', async t => {
  const backups = join(directory, 'dump-failure');
  const bin = join(directory, 'failed-bin');
  await mkdir(bin);
  await writeFile(join(bin, 'pg_dump'), '#!/bin/sh\nprintf partial-dump\nprintf dump-failed >&2\nexit 1\n');
  await chmod(join(bin, 'pg_dump'), 0o700);
  const path = process.env.PATH;
  const log = t.mock.method(console, 'error', () => {});
  try {
    process.env.PATH = `${bin}:${path}`;
    await start('2026-11-01T12:00:00Z', backups);
    assert.deepEqual(await readdir(backups), []);
    assert.equal(log.mock.calls.length, 1);
  } finally { process.env.PATH = path; }
  await start('2026-11-01T12:00:00Z', backups);
  assert.deepEqual(await readdir(backups), ['2026-11-01.dump']);
});
