import { afterEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testApp } from '../helpers/app';
import { taskEvents, tasks } from '../../src/persistence/schema';

const apps: ReturnType<typeof testApp>[] = [];
function start(options: Parameters<typeof testApp>[0] = {}) {
  const app = testApp(options);
  apps.push(app);
  return app;
}
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

type App = ReturnType<typeof testApp>;
const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const create = (app: App, title: string, target = 'backlog') =>
  app.request('/api/tasks', json({ title, target }));

it('creates a trimmed backlog task, counts it and lists it first', async () => {
  const app = start();
  for (let i = 1; i <= 7; i++) {
    expect((await create(app, `Task ${i}`)).status).toBe(201);
  }
  const response = await create(app, "  Renew driver's license  ");
  expect(response.status).toBe(201);
  const { task } = (await response.json()) as {
    task: { id: string; title: string; day: string | null };
  };
  expect(task.title).toBe("Renew driver's license");
  expect(task.day).toBeNull();

  const counts = await (await app.request('/api/counts')).json();
  expect(counts).toMatchObject({ backlog: 8 });
  const backlog = (await (await app.request('/api/views/backlog')).json()) as {
    tasks: { id: string }[];
  };
  expect(backlog.tasks).toHaveLength(8);
  expect(backlog.tasks[0]?.id).toBe(task.id);
});

it('adds to Today using the local date of the request zone and records added_to_today', async () => {
  const app = start({ testClock: true });
  await app.request('/api/test/clock', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ now: '2026-11-04T15:00:00.000Z' }),
  });
  const response = await create(app, 'Call the bank', 'today');
  expect(response.status).toBe(201);
  const { task } = (await response.json()) as {
    task: { id: string; day: string | null };
  };
  expect(task.day).toBe('2026-11-04');
  const events = app.database.db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, task.id))
    .all();
  expect(events.map((event) => event.type)).toEqual(['added_to_today']);
});

it.each([
  ['whitespace-only', '   '],
  ['201-character', 'a'.repeat(201)],
])(
  'rejects a %s title with invalid_title and creates nothing',
  async (_name, title) => {
    const app = start();
    const response = await create(app, title);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_title' },
    });
    expect(app.database.db.select().from(tasks).all()).toEqual([]);
  },
);
