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
const setClock = (app: App, now: string) =>
  send(app, 'PUT', '/api/test/clock', { now });
const create = async (app: App, title: string, target: 'backlog' | 'today') =>
  (
    (await (
      await send(app, 'POST', '/api/tasks', { title, target })
    ).json()) as { task: { id: string } }
  ).task.id;
const todayOpen = async (app: App) =>
  (
    (await (await app.request('/api/views/today')).json()) as {
      open: { title: string }[];
    }
  ).open.map((t) => t.title);
const setOrder = (app: App, taskIds: string[]) =>
  send(app, 'PUT', '/api/views/today/order', { taskIds });

/** Tasks A, B, C planned today at distinct instants, so Today shows C, B, A. */
async function seed() {
  const app = testApp({ testClock: true });
  apps.push(app);
  const ids: string[] = [];
  for (const [i, title] of ['A', 'B', 'C'].entries()) {
    await setClock(app, `2026-11-04T19:2${i}:00.000Z`);
    ids.push(await create(app, title, 'today'));
  }
  await setClock(app, '2026-11-04T19:30:00.000Z');
  return { app, a: ids[0]!, b: ids[1]!, c: ids[2]! };
}

it('orders open Today tasks A, C, B after setting the order, and puts a new task D last', async () => {
  const { app, a, b, c } = await seed();
  expect(await todayOpen(app)).toEqual(['C', 'B', 'A']);

  const response = await setOrder(app, [a, c, b]);
  expect(response.status).toBe(200);
  expect(await todayOpen(app)).toEqual(['A', 'C', 'B']);

  await create(app, 'D', 'today');
  expect(await todayOpen(app)).toEqual(['A', 'C', 'B', 'D']);
});

it('clears the position of a task moved to the backlog and planned for today again: it follows the ordered tasks', async () => {
  const { app, a, b, c } = await seed();
  await setOrder(app, [a, b, c]);
  expect(await todayOpen(app)).toEqual(['A', 'B', 'C']);

  await send(app, 'POST', `/api/tasks/${b}/move-to-backlog`);
  await send(app, 'POST', '/api/tasks/plan-today', { taskIds: [b] });
  expect(await todayOpen(app)).toEqual(['A', 'C', 'B']);
});

it('rejects an order containing a backlog task id with 400 and leaves the order unchanged', async () => {
  const { app, a, b, c } = await seed();
  const backlog = await create(app, 'Backlog task', 'backlog');
  await setOrder(app, [a, c, b]);

  const response = await setOrder(app, [a, backlog, c, b]);
  expect(response.status).toBe(400);
  expect(await todayOpen(app)).toEqual(['A', 'C', 'B']);
});
