import { afterEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testApp } from '../helpers/app';
import { taskEvents } from '../../src/persistence/schema';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
type App = ReturnType<typeof testApp>;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const setClock = (app: App, now: string) =>
  app.request('/api/test/clock', json('PUT', { now }));
const create = async (app: App, title: string, target: string) => {
  const response = await app.request(
    '/api/tasks',
    json('POST', { title, target }),
  );
  return ((await response.json()) as { task: { id: string } }).task.id;
};
const missedEvents = (app: App, taskId: string) =>
  app.database.db
    .select()
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, taskId), eq(taskEvents.type, 'missed')))
    .all();

/** Tasks open on Nov 2 and Nov 4, plus an older backlog task. */
async function seed(app: App) {
  await setClock(app, '2026-11-01T15:00:00.000Z');
  const backlogId = await create(app, 'Old backlog', 'backlog');
  await setClock(app, '2026-11-02T15:00:00.000Z');
  const nov2 = await create(app, 'Nov 2 task', 'today');
  await setClock(app, '2026-11-04T15:00:00.000Z');
  const nov4 = await create(app, 'Nov 4 task', 'today');
  return { backlogId, nov2, nov4 };
}

it('rolls overdue tasks to the top of the backlog on the first request after days away, once', async () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  const { backlogId, nov2, nov4 } = await seed(app);
  await setClock(app, '2026-11-08T15:00:00.000Z');

  const counts = await (await app.request('/api/counts')).json();
  expect(counts).toMatchObject({ backlog: 3 });

  const backlog = (await (await app.request('/api/views/backlog')).json()) as {
    tasks: { id: string; missedFrom: string | null }[];
  };
  expect(backlog.tasks).toHaveLength(3);
  expect(backlog.tasks.at(-1)?.id).toBe(backlogId);
  expect(
    backlog.tasks
      .slice(0, 2)
      .map((task) => [task.id, task.missedFrom])
      .sort(),
  ).toEqual(
    [
      [nov2, '2026-11-02'],
      [nov4, '2026-11-04'],
    ].sort(),
  );

  await app.request('/api/counts');
  await app.request('/api/views/backlog');
  expect(missedEvents(app, nov2)).toHaveLength(1);
  expect(missedEvents(app, nov4)).toHaveLength(1);
});

it('creates exactly one missed event per task for two concurrent requests after midnight', async () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  const { nov2, nov4 } = await seed(app);
  await setClock(app, '2026-11-05T05:00:05.000Z');

  await Promise.all([
    app.request('/api/counts'),
    app.request('/api/views/backlog'),
  ]);
  expect(missedEvents(app, nov2)).toHaveLength(1);
  expect(missedEvents(app, nov4)).toHaveLength(1);
});
