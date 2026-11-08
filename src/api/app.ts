import { parseSearchQuery, searchLocation } from '../domain/search';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { isTimeZone, localDate } from '../domain/time';
import {
  searchResponseSchema,
  clockSchema,
  createTaskRequestSchema,
  createTaskResponseSchema,
  taskTitleSchema,
  backlogResponseSchema,
  countsResponseSchema,
  taskDetailResponseSchema,
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
  app.post('/api/tasks', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = createTaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      const title =
        body && typeof body === 'object' && 'title' in body
          ? body.title
          : undefined;
      const invalidTitle = !taskTitleSchema.safeParse(title).success;
      return c.json(
        {
          error: {
            code: invalidTitle ? 'invalid_title' : 'invalid_request',
            message: invalidTitle
              ? 'Title must be between 1 and 200 characters.'
              : 'Choose backlog or today.',
          },
        },
        400,
      );
    }
    const task = repositories.tasks.create(
      parsed.data,
      clock.now(),
      c.req.header('X-Timezone')!,
    );
    return c.json(createTaskResponseSchema.parse({ task }), 201);
  });
  app.get('/api/views/backlog', (c) =>
    c.json(
      backlogResponseSchema.parse({
        tasks: repositories.tasks.backlog(c.req.query('listId')),
      }),
    ),
  );
  app.get('/api/search', (c) => {
    const query = parseSearchQuery(c.req.query('q') ?? '');
    if (!query)
      return c.json(
        { error: { code: 'invalid_query', message: 'Enter a search query.' } },
        400,
      );
    const zone = c.req.header('X-Timezone')!;
    const today = localDate(clock.now(), zone);
    return c.json(
      searchResponseSchema.parse({
        results: repositories.tasks.search(query).map((task) => ({
          ...task,
          location: searchLocation(task, today, zone),
        })),
      }),
    );
  });
  app.get('/api/counts', (c) =>
    c.json(
      countsResponseSchema.parse(
        repositories.tasks.counts(
          localDate(clock.now(), c.req.header('X-Timezone')!),
        ),
      ),
    ),
  );
  app.get('/api/tasks/:id', (c) => {
    const task = repositories.tasks.get(c.req.param('id'));
    if (!task)
      return c.json(
        { error: { code: 'not_found', message: 'Task not found.' } },
        404,
      );
    return c.json(
      taskDetailResponseSchema.parse({ task, subtasks: [], activity: [] }),
    );
  });
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
