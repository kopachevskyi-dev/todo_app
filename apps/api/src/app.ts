import express from 'express';
import type { Pool } from 'pg';
import type { Clock } from './clock.js';
import { dayRoutes } from './days.js';
import { tagRoutes } from './tags.js';
import { taskRoutes } from './tasks.js';

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
  app.use(express.json());
  app.use('/api', dayRoutes(pool, clock));
  app.use('/api', tagRoutes(pool));
  app.use('/api', taskRoutes(pool, clock));
  app.use((error: { status?: number }, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (response.headersSent) { next(error); return; }
    response.status(error.status === 400 ? 400 : 500).json({ message: error.status === 400 ? 'Invalid JSON.' : 'Unable to save changes. Please try again.' });
  });
  app.use('/api', (_request, response) => { response.status(404).json({ message: 'Not found' }); });
  if (webDirectory) app.use(express.static(webDirectory));
  return app;
}
