import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

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
const detail = async (app: App, id: string) =>
  (await (await app.request(`/api/tasks/${id}`)).json()) as {
    task: { subtaskCount: number; subtaskDoneCount: number };
    subtasks: { id: string; title: string; done: boolean }[];
    activity: { type: string; at: string; text: string }[];
  };

it('lists 3 added subtasks in creation order with subtaskCount 3, and subtaskDoneCount 1 after checking the first', async () => {
  const app = start();
  const id = await createTask(app);
  const titles = [
    'Find the old license',
    'Take a photo',
    'Book an appointment',
  ];
  const created: { id: string }[] = [];
  for (const title of titles) {
    const response = await send(app, 'POST', `/api/tasks/${id}/subtasks`, {
      title,
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      subtask: { id: string; title: string; done: boolean };
    };
    expect(body.subtask).toMatchObject({ title, done: false });
    created.push(body.subtask);
  }

  const before = await detail(app, id);
  expect(before.subtasks.map((subtask) => subtask.title)).toEqual(titles);
  expect(before.task.subtaskCount).toBe(3);

  const patched = await send(app, 'PATCH', `/api/subtasks/${created[0]!.id}`, {
    done: true,
  });
  expect(patched.status).toBe(200);
  expect(await patched.json()).toMatchObject({
    subtask: { id: created[0]!.id, done: true },
  });
  expect((await detail(app, id)).task.subtaskDoneCount).toBe(1);
});

it('merges a subtask added at 8:04 PM into the 8:03 PM "description added" event without a new event', async () => {
  const app = start();
  await setClock(app, '2026-11-04T01:00:00.000Z');
  const id = await createTask(app);
  await setClock(app, '2026-11-04T01:03:00.000Z');
  await send(app, 'PATCH', `/api/tasks/${id}`, {
    description: 'Bring the old license',
  });
  await setClock(app, '2026-11-04T01:04:00.000Z');
  const response = await send(app, 'POST', `/api/tasks/${id}/subtasks`, {
    title: 'Find the old license',
  });
  expect(response.status).toBe(201);

  const added = (await detail(app, id)).activity.filter(
    (item) => item.type === 'details_added',
  );
  expect(added).toEqual([
    {
      type: 'details_added',
      at: '2026-11-04T01:03:00.000Z',
      day: null,
      text: 'description and subtasks added',
    },
  ]);
});

it('rejects an empty subtask title with 400 invalid_title and an unknown task with 404', async () => {
  const app = start();
  const id = await createTask(app);
  const bad = await send(app, 'POST', `/api/tasks/${id}/subtasks`, {
    title: '',
  });
  expect(bad.status).toBe(400);
  expect(await bad.json()).toMatchObject({ error: { code: 'invalid_title' } });

  const missing = await send(
    app,
    'POST',
    '/api/tasks/01JBX7Q3M2V8R4K9T6N0P1S5WZ/subtasks',
    { title: 'Take a photo' },
  );
  expect(missing.status).toBe(404);
});
