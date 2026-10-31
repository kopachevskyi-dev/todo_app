import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { systemClock } from './clock.js';
import { migrate } from './migrate.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await migrate(pool);
const app = createApp({ pool, clock: systemClock(), webDirectory: fileURLToPath(new URL('../../web/dist/', import.meta.url)) });
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Day Planner is ready'));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
