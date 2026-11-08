import { serve } from '@hono/node-server';
import { openDatabase } from '../persistence/database';
import { createApp } from './app';
import { systemClock } from './clock';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error('PORT must be an integer from 0 to 65535.');
const database = openDatabase(process.env.DATABASE_PATH ?? './data/todo.db');
const app = createApp({
  db: database.db,
  clock: systemClock,
  testClock: process.env.ENABLE_TEST_CLOCK === 'true',
  webRoot: './dist/web',
});
const server = serve(
  { fetch: app.fetch, port, hostname: process.env.HOST ?? '127.0.0.1' },
  (address) => {
    console.log(JSON.stringify({ event: 'listening', port: address.port }));
  },
);
server.on('error', (error) => {
  console.error(error);
  database.close();
  process.exitCode = 1;
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => {
      database.close();
    });
  });
}
