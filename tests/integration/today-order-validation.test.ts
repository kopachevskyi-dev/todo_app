import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { tasks } from '../../src/persistence/schema';
import {
  examples,
  setTodayOrderResponseSchema,
  todayResponseSchema,
} from '../../src/shared/contract';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

async function setup() {
  const app = testApp({ testClock: true });
  apps.push(app);
  const send = (path: string, body?: unknown) =>
    app.request(path, {
      method:
        path.includes('/order') || path.includes('/clock') ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  await send('/api/test/clock', { now: '2026-11-10T14:00:00.000Z' });
  const ids: string[] = [];
  for (const title of ['A', 'B']) {
    const response = await send('/api/tasks', { title, target: 'today' });
    ids.push(((await response.json()) as { task: { id: string } }).task.id);
  }
  const order = (taskIds: string[]) =>
    send('/api/views/today/order', { taskIds });
  const openIds = async () =>
    todayResponseSchema
      .parse(await (await app.request('/api/views/today')).json())
      .open.map((task) => task.id);
  return { app, send, ids, order, openIds };
}

it('rejects duplicate, missing, and unknown ids atomically and validates the response contract', async () => {
  const { ids, order, openIds } = await setup();
  const response = await order(ids);
  expect(response.status).toBe(200);
  expect(setTodayOrderResponseSchema.parse(await response.json())).toEqual({
    taskIds: ids,
  });
  expect(
    setTodayOrderResponseSchema.parse(examples.todayOrderResponse),
  ).toEqual(examples.todayOrderResponse);
  for (const invalid of [
    [ids[0]!, ids[0]!],
    [ids[0]!],
    [ids[0]!, '01JBY3000000000000000000EF'],
  ]) {
    expect((await order(invalid)).status).toBe(400);
    expect(await openIds()).toEqual(ids);
  }
});

it('clears completed and rolled-over positions so returning tasks follow ordered tasks', async () => {
  const { app, send, ids, order, openIds } = await setup();
  const [a, b] = ids;
  await order(ids);
  await send(`/api/tasks/${a}/complete`);
  expect((await order(ids)).status).toBe(400);
  await send(`/api/tasks/${a}/reopen`);
  expect(await openIds()).toEqual([b, a]);
  await order(ids);
  await send('/api/test/clock', { now: '2026-11-11T14:00:00.000Z' });
  expect(await openIds()).toEqual([]);
  const rolledOver = app.database.db
    .select()
    .from(tasks)
    .all()
    .filter((task) => ids.includes(task.id));
  expect(rolledOver.map((task) => task.position)).toEqual([null, null]);
  await send('/api/tasks/plan-today', { taskIds: ids });
  await order([b!, a!]);
  await send(`/api/tasks/${b}/plan`, { day: '2026-11-12' });
  await send(`/api/tasks/${b}/plan`, { day: '2026-11-11' });
  expect(await openIds()).toEqual([a, b]);
});
