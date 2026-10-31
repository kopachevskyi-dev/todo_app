import express from 'express';
import type { Pool } from 'pg';
import type { Clock } from './clock.js';

export function createApp({ pool, clock, webDirectory }: { pool: Pool; clock: Clock; webDirectory?: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1 FROM public.schema_migrations LIMIT 1');
      response.json({ server: 'ready', database: 'ready', now: clock.now().toISOString(), timezone: clock.timezone });
    } catch {
      response.status(503).json({ server: 'ready', database: 'unavailable' });
    }
  });
  app.use('/api', (_request, response) => { response.status(404).json({ message: 'Not found' }); });
  if (webDirectory) app.use(express.static(webDirectory));
  return app;
}
