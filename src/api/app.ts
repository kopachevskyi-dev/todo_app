import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { isTimeZone } from '../domain/time';
import {
  clockSchema,
  healthResponseSchema,
  listsResponseSchema,
} from '../shared/contract';
import { createRepositories } from '../persistence/repositories';
import type { AppDatabase } from '../persistence/database';
import { createTestClock, type Clock } from './clock';

export function createApp(options: {
  db: AppDatabase;
  clock: Clock;
  testClock?: boolean;
  webRoot?: string;
  logError?: (error: Error) => void;
}) {
  const app = new Hono();
  const repositories = createRepositories(options.db);
  const clock = createTestClock(options.clock);
  app.use('/api/*', async (c, next) => {
    if (!isTimeZone(c.req.header('X-Timezone')))
      return c.json(
        {
          error: {
            code: 'invalid_timezone',
            message: 'A valid X-Timezone header is required.',
          },
        },
        400,
      );
    await next();
  });
  app.get('/api/health', (c) =>
    c.json(healthResponseSchema.parse({ ok: true })),
  );
  app.get('/api/lists', (c) =>
    c.json(listsResponseSchema.parse({ lists: repositories.lists.all() })),
  );
  if (options.testClock) {
    app.put('/api/test/clock', async (c) => {
      const body: unknown = await c.req.json().catch(() => null);
      const parsed = clockSchema.safeParse(body);
      if (!parsed.success)
        return c.json(
          {
            error: {
              code: 'invalid_request',
              message: 'now must be a UTC ISO instant.',
            },
          },
          400,
        );
      clock.set(new Date(parsed.data.now));
      return c.json(clockSchema.parse({ now: clock.now().toISOString() }));
    });
    app.get('/api/test/clock', (c) =>
      c.json(clockSchema.parse({ now: clock.now().toISOString() })),
    );
  }
  app.onError((error, c) => {
    (options.logError ?? console.error)(error);
    return c.json(
      {
        error: {
          code: 'internal_error',
          message: 'An unexpected error occurred.',
        },
      },
      500,
    );
  });
  app.notFound((c) =>
    c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404),
  );
  app.all('/api/*', (c) =>
    c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404),
  );
  if (options.webRoot) {
    app.use('/*', serveStatic({ root: options.webRoot }));
    app.get('*', serveStatic({ path: `${options.webRoot}/index.html` }));
  }
  return app;
}
