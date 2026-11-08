import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
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
const start = async () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  await send(app, 'PUT', '/api/test/clock', {
    now: '2026-11-04T19:20:00.000Z',
  });
  return app;
};
const create = async (app: App, title: string, target: 'backlog' | 'today') =>
  (
    (await (
      await send(app, 'POST', '/api/tasks', { title, target })
    ).json()) as {
      task: { id: string };
    }
  ).task.id;
const backlogCount = async (app: App) =>
  (
    (await (await app.request('/api/views/backlog')).json()) as {
      tasks: unknown[];
    }
  ).tasks.length;
const detail = async (app: App, id: string) =>
  (await (await app.request(`/api/tasks/${id}`)).json()) as {
    task: { day: string | null };
    activity: { type: string }[];
  };

it('plans the selected backlog tasks for today: day set, planned event recorded, backlog 3 → 1', async () => {
  const app = await start();
  const a = await create(app, 'Task A', 'backlog');
  const b = await create(app, 'Task B', 'backlog');
  await create(app, 'Task C', 'backlog');
  expect(await backlogCount(app)).toBe(3);

  const response = await send(app, 'POST', '/api/tasks/plan-today', {
    taskIds: [a, b],
  });
  expect(response.status).toBe(200);
  const { tasks } = (await response.json()) as {
    tasks: { id: string; day: string }[];
  };
  expect(tasks.map((t) => t.id).sort()).toEqual([a, b].sort());
  for (const id of [a, b]) {
    const { task, activity } = await detail(app, id);
    expect(task.day).toBe('2026-11-04');
    expect(activity.filter((e) => e.type === 'planned')).toHaveLength(1);
  }
  expect(await backlogCount(app)).toBe(1);
});

it('rejects a request containing an already planned task with 409 not_in_backlog and changes nothing', async () => {
  const app = await start();
  const a = await create(app, 'Task A', 'backlog');
  const d = await create(app, 'Task D', 'today');

  const response = await send(app, 'POST', '/api/tasks/plan-today', {
    taskIds: [a, d],
  });
  expect(response.status).toBe(409);
  expect(
    ((await response.json()) as { error: { code: string } }).error.code,
  ).toBe('not_in_backlog');
  const { task, activity } = await detail(app, a);
  expect(task.day).toBeNull();
  expect(activity.filter((e) => e.type === 'planned')).toHaveLength(0);
  expect(await backlogCount(app)).toBe(1);
});
