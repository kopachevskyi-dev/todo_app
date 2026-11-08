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
async function createTask(app: App, target: 'backlog' | 'today') {
  const response = await send(app, 'POST', '/api/tasks', {
    title: "Renew driver's license",
    target,
  });
  return ((await response.json()) as { task: { id: string } }).task.id;
}
type Detail = {
  task: { completedAt: string | null; day: string | null };
  activity: { type: string; day: string | null }[];
};
const detail = async (app: App, id: string) =>
  (await (await app.request(`/api/tasks/${id}`)).json()) as Detail;

it('completes at 2:20 PM New York with a completed event for 2026-11-04, rejects a second complete with 409 already_done, and reopens with a reopened event', async () => {
  const app = start();
  await send(app, 'PUT', '/api/test/clock', {
    now: '2026-11-04T19:20:00.000Z',
  });
  const id = await createTask(app, 'today');

  const done = await send(app, 'POST', `/api/tasks/${id}/complete`);
  expect(done.status).toBe(200);
  expect(await done.json()).toMatchObject({
    task: { id, completedAt: '2026-11-04T19:20:00.000Z' },
  });
  expect((await detail(app, id)).activity).toContainEqual(
    expect.objectContaining({ type: 'completed', day: '2026-11-04' }),
  );

  const again = await send(app, 'POST', `/api/tasks/${id}/complete`);
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({ error: { code: 'already_done' } });

  const reopened = await send(app, 'POST', `/api/tasks/${id}/reopen`);
  expect(reopened.status).toBe(200);
  expect(await reopened.json()).toMatchObject({
    task: { id, completedAt: null },
  });
  expect((await detail(app, id)).activity).toContainEqual(
    expect.objectContaining({ type: 'reopened', day: '2026-11-04' }),
  );
});

it('completing a backlog task on Nov 4 sets day 2026-11-04, removes it from the backlog view and lists it in today done', async () => {
  const app = start();
  await send(app, 'PUT', '/api/test/clock', {
    now: '2026-11-04T19:20:00.000Z',
  });
  const id = await createTask(app, 'backlog');

  const done = await send(app, 'POST', `/api/tasks/${id}/complete`);
  expect(done.status).toBe(200);
  expect(await done.json()).toMatchObject({ task: { id, day: '2026-11-04' } });

  const backlog = (await (await app.request('/api/views/backlog')).json()) as {
    tasks: { id: string }[];
  };
  expect(backlog.tasks.map((t) => t.id)).not.toContain(id);
  const today = (await (await app.request('/api/views/today')).json()) as {
    done: { id: string }[];
  };
  expect(today.done.map((t) => t.id)).toEqual([id]);
});
