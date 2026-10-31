import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { systemClock } from './clock.js';
import { startServer } from './server.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const server = await startServer({ pool, clock: systemClock(), databaseUrl: process.env.DATABASE_URL,
  backupsDirectory: process.env.BACKUPS_DIR || '/tmp/day-planner-backups',
  webDirectory: fileURLToPath(new URL('../../web/dist/', import.meta.url)), port: Number(process.env.PORT || 3000), host: '0.0.0.0' });
console.log('Day Planner is ready');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
