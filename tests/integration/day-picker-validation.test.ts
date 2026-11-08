import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { tasks } from '../../src/persistence/schema';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
const start = () => {
  const app = testApp();
  apps.push(app);
  return app;
};
const id = '01JBX7Q3M2V8R4K9T6N0TSK010';
const at = '2026-11-02T14:12:00.000Z';

it('validates ranges, including missing, reversed and over 62 days', async () => {
  const app = start();
  for (const query of [
    '',
    '?from=bad&to=2026-11-04',
    '?from=2026-11-05&to=2026-11-04',
    '?from=2026-11-01&to=2027-01-02',
  ]) {
    expect((await app.request(`/api/day-load${query}`)).status).toBe(400);
  }
  const response = await app.request(
    '/api/day-load?from=2026-11-01&to=2027-01-01',
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { days: Record<string, number> };
  expect(Object.keys(body.days)).toHaveLength(62);
});

it('rejects missing tasks, malformed plans and completed tasks', async () => {
  const app = start();
  const plan = (body: unknown) =>
    app.request(`/api/tasks/${id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  expect((await plan({ day: null })).status).toBe(404);
  app.database.db
    .insert(tasks)
    .values({ id, title: 'Task', placedAt: at, createdAt: at, updatedAt: at })
    .run();
  for (const body of [{}, { day: '2026-02-30' }, { day: null, other: true }])
    expect((await plan(body)).status).toBe(400);
  app.database.db.update(tasks).set({ completedAt: at }).run();
  const response = await plan({ day: null });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: 'task_completed' },
  });
});

it('counts done tasks and moves an open planned task back with a new placement and event', async () => {
  const app = start();
  app.database.db
    .insert(tasks)
    .values({
      id,
      title: 'Task',
      day: '2026-11-04',
      placedAt: at,
      createdAt: at,
      updatedAt: at,
      completedAt: at,
    })
    .run();
  const load = await app.request('/api/day-load?from=2026-11-04&to=2026-11-04');
  expect(await load.json()).toEqual({ days: { '2026-11-04': 1 } });
  app.database.db.update(tasks).set({ completedAt: null }).run();
  const response = await app.request(`/api/tasks/${id}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day: null }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    task: { day: null, missedFrom: null },
  });
  expect(app.database.db.select().from(tasks).get()?.placedAt).toBe(
    '2026-11-04T19:20:00.000Z',
  );
  const detail = await app.request(`/api/tasks/${id}`);
  expect(await detail.json()).toMatchObject({
    activity: [{ type: 'moved_to_backlog', day: null }],
  });
});

it('supplies the injected clock to the picker without exposing the test control routes', async () => {
  const app = start();
  expect(await (await app.request('/api/clock')).json()).toEqual({
    now: '2026-11-04T19:20:00.000Z',
  });
  expect((await app.request('/api/test/clock')).status).toBe(404);
});
