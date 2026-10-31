import type { Pool } from 'pg';
import { createApp } from './app.js';
import { backupDatabase } from './backups.js';
import type { Clock } from './clock.js';
import { migrate } from './migrate.js';

export async function startServer(options: {
  pool: Pool;
  clock: Clock;
  backupsDirectory: string;
  databaseUrl?: string;
  webDirectory?: string;
  port?: number;
  host?: string;
}) {
  await migrate(options.pool);
  try { await backupDatabase(options); }
  catch (error) { console.error('Daily backup failed; starting without a new backup:', error); }
  const app = createApp(options);
  const server = app.listen(options.port ?? 0, options.host ?? '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  return server;
}
