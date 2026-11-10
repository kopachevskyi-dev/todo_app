import { apiError } from './errors';
import { historyWeekStart } from '../domain/history';
import { z } from 'zod';
import { addDays } from '../domain/day-picker';
import { activityText } from '../domain/activity';
import { parseSearchQuery, searchLocation } from '../domain/search';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { isTimeZone, localDate } from '../domain/time';
import {
  createListRequestSchema,
  patchListRequestSchema,
  listResponseSchema,
  listColors,
  historyResponseSchema,
  upcomingResponseSchema,
  createSubtaskRequestSchema,
  patchSubtaskRequestSchema,
  subtaskResponseSchema,
  planTaskRequestSchema,
  planTodayRequestSchema,
  planTodayResponseSchema,
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
      return apiError(
        c,
        'invalid_timezone',
        'A valid X-Timezone header is required.',
        400,
      );
    repositories.tasks.rollover(clock.now(), c.req.header('X-Timezone')!);
    await next();
  });
  app.get('/api/health', (c) =>
    c.json(healthResponseSchema.parse({ ok: true })),
  );
  app.get('/api/lists', (c) =>
    c.json(listsResponseSchema.parse({ lists: repositories.lists.all() })),
  );
  app.post('/api/lists', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (
      body &&
      typeof body === 'object' &&
      'color' in body &&
      !listColors.includes(body.color as (typeof listColors)[number])
    )
      return apiError(
        c,
        'invalid_color',
        'Choose one of the five list colors.',
        400,
      );
    const parsed = createListRequestSchema.safeParse(body);
    if (!parsed.success)
      return apiError(
        c,
        'invalid_request',
        'List name must be between 1 and 40 characters.',
        400,
      );
    const duplicate = repositories.lists.named(parsed.data.name);
    if (duplicate)
      return apiError(
        c,
        'list_exists',
        'A list with that name already exists.',
        409,
      );
    const list = repositories.lists.create(parsed.data, clock.now());
    return c.json(listResponseSchema.parse({ list }), 201);
  });
  app.patch('/api/lists/:id', async (c) => {
    const id = c.req.param('id');
    if (!repositories.lists.get(id))
      return apiError(c, 'not_found', 'List not found.', 404);
    const body: unknown = await c.req.json().catch(() => null);
    if (
      body &&
      typeof body === 'object' &&
      'color' in body &&
      !listColors.includes(body.color as (typeof listColors)[number])
    )
      return apiError(
        c,
        'invalid_color',
        'Choose one of the five list colors.',
        400,
      );
    const parsed = patchListRequestSchema.safeParse(body);
    if (!parsed.success)
      return apiError(
        c,
        'invalid_request',
        'List name must be between 1 and 40 characters.',
        400,
      );
    const duplicate = parsed.data.name
      ? repositories.lists.named(parsed.data.name)
      : undefined;
    if (duplicate && duplicate.id !== id)
      return apiError(
        c,
        'list_exists',
        'A list with that name already exists.',
        409,
      );
    const list = repositories.lists.patch(id, parsed.data);
    return c.json(listResponseSchema.parse({ list }));
  });
  app.delete('/api/lists/:id', (c) => {
    const id = c.req.param('id');
    if (!repositories.lists.get(id))
      return apiError(c, 'not_found', 'List not found.', 404);
    repositories.lists.delete(id);
    return c.body(null, 204);
  });
  app.post('/api/tasks', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = createTaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      const title =
        body && typeof body === 'object' && 'title' in body
          ? body.title
          : undefined;
      const invalidTitle = !taskTitleSchema.safeParse(title).success;
      return apiError(
        c,
        invalidTitle ? 'invalid_title' : 'invalid_request',
        invalidTitle
          ? 'Title must be between 1 and 200 characters.'
          : 'Choose backlog or today.',
        400,
      );
    }
    if (parsed.data.listId && !repositories.lists.get(parsed.data.listId))
      return apiError(c, 'invalid_list', 'List not found.', 400);
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
  app.get('/api/upcoming', (c) =>
    c.json(
      upcomingResponseSchema.parse(
        repositories.tasks.upcoming(
          localDate(clock.now(), c.req.header('X-Timezone')!),
        ),
      ),
    ),
  );
  app.get('/api/views/history', (c) => {
    const week = z.iso.date().safeParse(c.req.query('weekStart'));
    if (!week.success || historyWeekStart(week.data) !== week.data)
      return apiError(
        c,
        'invalid_week',
        'Choose a Monday for the week start.',
        400,
      );
    return c.json(
      historyResponseSchema.parse(
        repositories.tasks.history(
          week.data,
          clock.now(),
          c.req.header('X-Timezone')!,
          c.req.query('listId'),
        ),
      ),
    );
  });
  app.post('/api/tasks/:id/move-to-backlog', (c) => {
    const task = repositories.tasks.get(c.req.param('id'));
    if (!task) return apiError(c, 'not_found', 'Task not found.', 404);
    if (!task.completedAt)
      return apiError(c, 'not_done', 'Task is not done.', 409);
    return c.json(
      createTaskResponseSchema.parse({
        task: repositories.tasks.moveToBacklog(task.id, clock.now()),
      }),
    );
  });
  app.post('/api/tasks/:id/complete', (c) => {
    const task = repositories.tasks.get(c.req.param('id'));
    if (!task) return apiError(c, 'not_found', 'Task not found.', 404);
    if (task.completedAt)
      return apiError(c, 'already_done', 'Task is already done.', 409);
    return c.json(
      createTaskResponseSchema.parse({
        task: repositories.tasks.setCompletion(
          task.id,
          true,
          clock.now(),
          c.req.header('X-Timezone')!,
        ),
      }),
    );
  });
  app.post('/api/tasks/:id/reopen', (c) => {
    const task = repositories.tasks.get(c.req.param('id'));
    if (!task) return apiError(c, 'not_found', 'Task not found.', 404);
    if (!task.completedAt)
      return apiError(c, 'not_done', 'Task is not done.', 409);
    return c.json(
      createTaskResponseSchema.parse({
        task: repositories.tasks.setCompletion(
          task.id,
          false,
          clock.now(),
          c.req.header('X-Timezone')!,
        ),
      }),
    );
  });
  app.get('/api/search', (c) => {
    const query = parseSearchQuery(c.req.query('q') ?? '');
    if (!query)
      return apiError(c, 'invalid_query', 'Enter a search query.', 400);
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
    if (!task) return apiError(c, 'not_found', 'Task not found.', 404);
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
      return apiError(c, 'not_found', 'Task not found.', 404);
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = patchTaskRequestSchema.safeParse(body);
    if (!parsed.success)
      return apiError(c, 'invalid_request', 'Invalid task details.', 400);
    if (
      parsed.data.listId !== undefined &&
      parsed.data.listId !== null &&
      !repositories.lists.get(parsed.data.listId)
    )
      return apiError(c, 'invalid_list', 'List not found.', 400);
    return c.json(
      createTaskResponseSchema.parse({
        task: repositories.tasks.patch(id, parsed.data, clock.now()),
      }),
    );
  });
  app.post('/api/tasks/:id/subtasks', async (c) => {
    const id = c.req.param('id');
    if (!repositories.tasks.get(id))
      return apiError(c, 'not_found', 'Task not found.', 404);
    const parsed = createSubtaskRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return apiError(
        c,
        'invalid_title',
        'Title must be between 1 and 200 characters.',
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
    if (!subtask) return apiError(c, 'not_found', 'Subtask not found.', 404);
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = patchSubtaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      const invalidTitle =
        body &&
        typeof body === 'object' &&
        'title' in body &&
        !taskTitleSchema.safeParse(body.title).success;
      return apiError(
        c,
        invalidTitle ? 'invalid_title' : 'invalid_request',
        'Invalid subtask details.',
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
      return apiError(c, 'not_found', 'Subtask not found.', 404);
    repositories.subtasks.delete(id, clock.now());
    return c.body(null, 204);
  });
  app.post('/api/tasks/plan-today', async (c) => {
    const parsed = planTodayRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return apiError(
        c,
        'invalid_request',
        'Choose 1 to 100 backlog tasks.',
        400,
      );
    const now = clock.now();
    const result = repositories.tasks.planToday(
      parsed.data.taskIds,
      localDate(now, c.req.header('X-Timezone')!),
      now,
    );
    if ('taskIds' in result)
      return apiError(
        c,
        'not_in_backlog',
        'One or more tasks are not in the backlog.',
        409,
        result.taskIds,
      );
    return c.json(planTodayResponseSchema.parse(result));
  });
  app.post('/api/tasks/:id/plan', async (c) => {
    const id = c.req.param('id');
    const task = repositories.tasks.get(id);
    if (!task) return apiError(c, 'not_found', 'Task not found.', 404);
    const parsed = planTaskRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return apiError(c, 'invalid_request', 'Choose a valid day.', 400);
    const now = clock.now();
    if (
      parsed.data.day &&
      parsed.data.day < localDate(now, c.req.header('X-Timezone')!)
    )
      return apiError(c, 'day_in_past', 'Choose today or a later day.', 400);
    if (task.completedAt)
      return apiError(
        c,
        'task_completed',
        'Only open tasks can be planned.',
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
      return apiError(
        c,
        'invalid_range',
        'Choose a range of 1 to 62 days.',
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
      return apiError(c, 'not_found', 'Task not found.', 404);
    repositories.tasks.delete(c.req.param('id'));
    return c.body(null, 204);
  });
  if (options.testClock) {
    app.get('/api/clock', (c) =>
      c.json(clockSchema.parse({ now: clock.now().toISOString() })),
    );

    app.put('/api/test/clock', async (c) => {
      const body: unknown = await c.req.json().catch(() => null);
      const parsed = clockSchema.safeParse(body);
      if (!parsed.success)
        return apiError(
          c,
          'invalid_request',
          'now must be a UTC ISO instant.',
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
    return apiError(c, 'internal_error', 'An unexpected error occurred.', 500);
  });
  app.notFound((c) => apiError(c, 'not_found', 'Not found.', 404));
  app.all('/api/*', (c) => apiError(c, 'not_found', 'Not found.', 404));
  if (options.webRoot) {
    app.use('/*', serveStatic({ root: options.webRoot }));
    app.get('*', serveStatic({ path: `${options.webRoot}/index.html` }));
  }
  return app;
}
