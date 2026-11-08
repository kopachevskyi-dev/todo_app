import { afterEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testApp } from '../helpers/app';
import { subtasks, taskEvents, tasks } from '../../src/persistence/schema';

const PERSONAL = '01JBX0000000000000000PERSN';
const apps: ReturnType<typeof testApp>[] = [];
const start = () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  return app;
};
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
type App = ReturnType<typeof testApp>;
const send = (app: App, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const setClock = (app: App, now: string) =>
  send(app, 'PUT', '/api/test/clock', { now });
async function createTask(app: App) {
  const response = await send(app, 'POST', '/api/tasks', {
    title: "Renew driver's license",
    target: 'backlog',
  });
  return ((await response.json()) as { task: { id: string } }).task.id;
}

it('merges a description edit and a list edit 2 minutes later into one details_added event', async () => {
  const app = start();
  await setClock(app, '2026-11-04T01:00:00.000Z');
  const id = await createTask(app);
  await setClock(app, '2026-11-04T01:03:00.000Z');
  expect(
    (
      await send(app, 'PATCH', `/api/tasks/${id}`, {
        description: 'Bring the old license',
      })
    ).status,
  ).toBe(200);
  await setClock(app, '2026-11-04T01:05:00.000Z');
  expect(
    (await send(app, 'PATCH', `/api/tasks/${id}`, { listId: PERSONAL })).status,
  ).toBe(200);

  const detail = (await (await app.request(`/api/tasks/${id}`)).json()) as {
    task: { description: string; listId: string };
    activity: { type: string; at: string; text: string }[];
  };
  expect(detail.task).toMatchObject({
    description: 'Bring the old license',
    listId: PERSONAL,
  });
  const added = detail.activity.filter((item) => item.type === 'details_added');
  expect(added).toEqual([
    {
      type: 'details_added',
      at: '2026-11-04T01:03:00.000Z',
      day: null,
      text: 'description and list added',
    },
  ]);
});

it('rejects an unknown list with 400 invalid_list and an unknown task with 404 not_found', async () => {
  const app = start();
  const id = await createTask(app);
  const bad = await send(app, 'PATCH', `/api/tasks/${id}`, { listId: 'nope' });
  expect(bad.status).toBe(400);
  expect(await bad.json()).toMatchObject({ error: { code: 'invalid_list' } });
  const missing = await send(
    app,
    'PATCH',
    '/api/tasks/01JBX7Q3M2V8R4K9T6N0P1S5WZ',
    {
      title: 'x',
    },
  );
  expect(missing.status).toBe(404);
  expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } });
});

it('deletes a task with 2 subtasks and 3 events, leaving nothing behind', async () => {
  const app = start();
  const id = await createTask(app);
  const db = app.database.db;
  const at = '2026-11-04T01:00:00.000Z';
  db.insert(subtasks)
    .values([
      {
        id: '01JBX7Q3M2V8R4K9T6N0SUB001',
        taskId: id,
        title: 'One',
        position: 0,
        createdAt: at,
      },
      {
        id: '01JBX7Q3M2V8R4K9T6N0SUB002',
        taskId: id,
        title: 'Two',
        position: 1,
        createdAt: at,
      },
    ])
    .run();
  db.insert(taskEvents)
    .values([
      {
        id: '01JBX7Q3M2V8R4K9T6N0EVT001',
        taskId: id,
        type: 'planned',
        at,
        day: '2026-11-04',
      },
      {
        id: '01JBX7Q3M2V8R4K9T6N0EVT002',
        taskId: id,
        type: 'completed',
        at,
        day: '2026-11-04',
      },
    ])
    .run();
  expect(
    db.select().from(taskEvents).where(eq(taskEvents.taskId, id)).all(),
  ).toHaveLength(3);

  const response = await send(app, 'DELETE', `/api/tasks/${id}`);
  expect(response.status).toBe(204);
  expect((await app.request(`/api/tasks/${id}`)).status).toBe(404);
  expect(db.select().from(tasks).where(eq(tasks.id, id)).all()).toEqual([]);
  expect(
    db.select().from(subtasks).where(eq(subtasks.taskId, id)).all(),
  ).toEqual([]);
  expect(
    db.select().from(taskEvents).where(eq(taskEvents.taskId, id)).all(),
  ).toEqual([]);
});
