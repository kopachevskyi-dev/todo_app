import { activityText } from '../domain/activity';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { isTimeZone, localDate } from '../domain/time';
import {
  clockSchema,
  patchTaskRequestSchema,
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
      taskDetailResponseSchema.parse({
        task,
        subtasks: repositories.tasks.subtasks(task.id),
        activity: repositories.tasks.events(task.id).map((event) => ({
          type: event.type,
          at: event.at,
          day: event.day,
          text: activityText(event),
        })),
      }),
    );
  });
  app.patch('/api/tasks/:id', async (c) => {
    const id = c.req.param('id');
    if (!repositories.tasks.get(id))
      return c.json(
        { error: { code: 'not_found', message: 'Task not found.' } },
        404,
      );
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = patchTaskRequestSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        {
          error: { code: 'invalid_request', message: 'Invalid task details.' },
        },
        400,
      );
    if (
      parsed.data.listId !== undefined &&
      parsed.data.listId !== null &&
      !repositories.lists.all().some((list) => list.id === parsed.data.listId)
    )
      return c.json(
        { error: { code: 'invalid_list', message: 'List not found.' } },
        400,
      );
    return c.json(
      createTaskResponseSchema.parse({
        task: repositories.tasks.patch(id, parsed.data, clock.now()),
      }),
    );
  });
  app.delete('/api/tasks/:id', (c) => {
    if (!repositories.tasks.get(c.req.param('id')))
      return c.json(
        { error: { code: 'not_found', message: 'Task not found.' } },
        404,
      );
    repositories.tasks.delete(c.req.param('id'));
    return c.body(null, 204);
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
