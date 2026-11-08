import { z } from 'zod';
import { addDays } from '../domain/day-picker';
import { activityText } from '../domain/activity';
import { parseSearchQuery, searchLocation } from '../domain/search';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { isTimeZone, localDate } from '../domain/time';
import {
  createSubtaskRequestSchema,
  patchSubtaskRequestSchema,
  subtaskResponseSchema,
  planTaskRequestSchema,
  dayLoadResponseSchema,
  todayResponseSchema,
  searchResponseSchema,
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
  app.get('/api/views/today', (c) =>
    c.json(
      todayResponseSchema.parse(
        repositories.tasks.today(
          localDate(clock.now(), c.req.header('X-Timezone')!),
          c.req.query('listId'),
        ),
      ),
    ),
  );
  for (const action of ['complete', 'reopen'] as const) {
    app.post(`/api/tasks/:id/${action}`, (c) => {
      const task = repositories.tasks.get(c.req.param('id'));
      if (!task)
        return c.json(
          { error: { code: 'not_found', message: 'Task not found.' } },
          404,
        );
      const completed = action === 'complete';
      if (Boolean(task.completedAt) === completed)
        return c.json(
          {
            error: {
              code: completed ? 'already_done' : 'not_done',
              message: completed
                ? 'Task is already done.'
                : 'Task is not done.',
            },
          },
          409,
        );
      return c.json(
        createTaskResponseSchema.parse({
          task: repositories.tasks.setCompletion(
            task.id,
            completed,
            clock.now(),
            c.req.header('X-Timezone')!,
          ),
        }),
      );
    });
  }
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
  app.post('/api/tasks/:id/subtasks', async (c) => {
    const id = c.req.param('id');
    if (!repositories.tasks.get(id))
      return c.json(
        { error: { code: 'not_found', message: 'Task not found.' } },
        404,
      );
    const parsed = createSubtaskRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return c.json(
        {
          error: {
            code: 'invalid_title',
            message: 'Title must be between 1 and 200 characters.',
          },
        },
        400,
      );
    return c.json(
      subtaskResponseSchema.parse({
        subtask: repositories.subtasks.create(
          id,
          parsed.data.title,
          clock.now(),
        ),
      }),
      201,
    );
  });
  app.patch('/api/subtasks/:id', async (c) => {
    const id = c.req.param('id');
    const subtask = repositories.subtasks.get(id);
    if (!subtask)
      return c.json(
        { error: { code: 'not_found', message: 'Subtask not found.' } },
        404,
      );
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = patchSubtaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      const invalidTitle =
        body &&
        typeof body === 'object' &&
        'title' in body &&
        !taskTitleSchema.safeParse(body.title).success;
      return c.json(
        {
          error: {
            code: invalidTitle ? 'invalid_title' : 'invalid_request',
            message: 'Invalid subtask details.',
          },
        },
        400,
      );
    }
    return c.json(
      subtaskResponseSchema.parse({
        subtask: Object.keys(parsed.data).length
          ? repositories.subtasks.patch(id, parsed.data, clock.now())
          : subtask,
      }),
    );
  });
  app.delete('/api/subtasks/:id', (c) => {
    const id = c.req.param('id');
    if (!repositories.subtasks.get(id))
      return c.json(
        { error: { code: 'not_found', message: 'Subtask not found.' } },
        404,
      );
    repositories.subtasks.delete(id, clock.now());
    return c.body(null, 204);
  });
  app.get('/api/clock', (c) =>
    c.json(clockSchema.parse({ now: clock.now().toISOString() })),
  );
  app.post('/api/tasks/:id/plan', async (c) => {
    const id = c.req.param('id');
    const task = repositories.tasks.get(id);
    if (!task)
      return c.json(
        { error: { code: 'not_found', message: 'Task not found.' } },
        404,
      );
    const parsed = planTaskRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return c.json(
        { error: { code: 'invalid_request', message: 'Choose a valid day.' } },
        400,
      );
    const now = clock.now();
    if (
      parsed.data.day &&
      parsed.data.day < localDate(now, c.req.header('X-Timezone')!)
    )
      return c.json(
        {
          error: {
            code: 'day_in_past',
            message: 'Choose today or a later day.',
          },
        },
        400,
      );
    if (task.completedAt)
      return c.json(
        {
          error: {
            code: 'task_completed',
            message: 'Only open tasks can be planned.',
          },
        },
        400,
      );
    return c.json(
      createTaskResponseSchema.parse({
        task: repositories.tasks.plan(id, parsed.data.day, now),
      }),
    );
  });
  app.get('/api/day-load', (c) => {
    const range = z
      .object({ from: z.iso.date(), to: z.iso.date() })
      .safeParse(c.req.query());
    if (
      !range.success ||
      range.data.to < range.data.from ||
      (Date.parse(range.data.to) - Date.parse(range.data.from)) / 86400000 >= 62
    )
      return c.json(
        {
          error: {
            code: 'invalid_range',
            message: 'Choose a range of 1 to 62 days.',
          },
        },
        400,
      );
    const { from, to } = range.data;
    const days: Record<string, number> = {};
    for (let day = from; ; day = addDays(day, 1)) {
      days[day] = 0;
      if (day === to) break;
    }
    for (const row of repositories.tasks.dayLoad(from, to))
      if (row.day) days[row.day] = row.count;
    return c.json(dayLoadResponseSchema.parse({ days }));
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
