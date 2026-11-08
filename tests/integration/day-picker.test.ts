import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { tasks } from '../../src/persistence/schema';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
type App = ReturnType<typeof testApp>;
const start = async () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  await app.request('/api/test/clock', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ now: '2026-11-03T20:05:00.000Z' }),
  });
  return app;
};
const plan = (app: App, id: string, day: string | null) =>
  app.request(`/api/tasks/${id}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day }),
  });
const at = '2026-11-02T14:12:00.000Z';
const insert = (
  app: App,
  id: string,
  extra: { day?: string; missedFrom?: string } = {},
) =>
  app.database.db
    .insert(tasks)
    .values({
      id,
      title: `Task ${id.slice(-3)}`,
      placedAt: at,
      createdAt: at,
      updatedAt: at,
      ...extra,
    })
    .run();

it('returns the load for every day in the range, with zeros for empty days', async () => {
  const app = await start();
  for (const n of [1, 2, 3, 4])
    insert(app, `01JBX7Q3M2V8R4K9T6N0TSK00${n}`, { day: '2026-11-04' });
  const response = await app.request(
    '/api/day-load?from=2026-11-03&to=2026-11-07',
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    days: {
      '2026-11-03': 0,
      '2026-11-04': 4,
      '2026-11-05': 0,
      '2026-11-06': 0,
      '2026-11-07': 0,
    },
  });
});

it('plans a missed backlog task: sets day, clears missedFrom, records planned, leaves the Backlog; a past day is 400 day_in_past', async () => {
  const app = await start();
  const id = '01JBX7Q3M2V8R4K9T6N0TSK010';
  insert(app, id, { missedFrom: '2026-11-02' });
  const backlogIds = async () =>
    (
      (await (await app.request('/api/views/backlog')).json()) as {
        tasks: { id: string }[];
      }
    ).tasks.map((task) => task.id);
  expect(await backlogIds()).toContain(id);

  const past = await plan(app, id, '2026-11-02');
  expect(past.status).toBe(400);
  expect(await past.json()).toEqual({
    error: { code: 'day_in_past', message: 'Choose today or a later day.' },
  });

  const response = await plan(app, id, '2026-11-04');
  expect(response.status).toBe(200);
  const { task } = (await response.json()) as { task: unknown };
  expect(task).toMatchObject({ id, day: '2026-11-04', missedFrom: null });

  const detail = (await (await app.request(`/api/tasks/${id}`)).json()) as {
    activity: { type: string; day: string | null; text: string }[];
  };
  expect(detail.activity.filter((a) => a.type === 'planned')).toMatchObject([
    { day: '2026-11-04', text: 'planned for Nov 4' },
  ]);
  expect(await backlogIds()).not.toContain(id);
});
