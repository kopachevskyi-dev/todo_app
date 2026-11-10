import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
type App = ReturnType<typeof testApp>;
const send = (
  app: App,
  method: string,
  path: string,
  body?: unknown,
  zone = 'America/New_York',
) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Timezone': zone },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const start = () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  return app;
};
const clock = (app: App, now: string) =>
  send(app, 'PUT', '/api/test/clock', { now });
const create = async (app: App, title: string) =>
  (
    (await (
      await send(app, 'POST', '/api/tasks', { title, target: 'today' })
    ).json()) as { task: { id: string } }
  ).task.id;
type Task = { id: string; day: string | null };
const get = async <T>(app: App, path: string, zone?: string) =>
  (await (await send(app, 'GET', path, undefined, zone)).json()) as T;
const todayView = (app: App) =>
  get<{ open: Task[]; done: Task[] }>(app, '/api/views/today');
const historyDone = async (
  app: App,
  weekStart: string,
  day: string,
  zone?: string,
) =>
  (
    await get<{ days: { day: string; groups: { done: Task[] } }[] }>(
      app,
      `/api/views/history?weekStart=${weekStart}`,
      zone,
    )
  ).days
    .find((d) => d.day === day)!
    .groups.done.map((t) => t.id);

it('moves a task planned for Nov 12 to today when it is completed on Nov 10 in New York, and keeps it on today when reopened', async () => {
  const app = start();
  await clock(app, '2026-11-10T14:00:00.000Z');
  const id = await create(app, 'Report');
  await send(app, 'POST', `/api/tasks/${id}/plan`, { day: '2026-11-12' });

  const done = await send(app, 'POST', `/api/tasks/${id}/complete`);
  expect(await done.json()).toMatchObject({
    task: { id, day: '2026-11-10' },
  });
  expect((await todayView(app)).done.map((t) => t.id)).toEqual([id]);
  expect(await historyDone(app, '2026-11-09', '2026-11-10')).toEqual([id]);
  const load = await get<{ days: Record<string, number> }>(
    app,
    '/api/day-load?from=2026-11-12&to=2026-11-12',
  );
  expect(load.days['2026-11-12']).toBe(0);

  const reopened = await send(app, 'POST', `/api/tasks/${id}/reopen`);
  expect(await reopened.json()).toMatchObject({
    task: { id, day: '2026-11-10' },
  });
});

it('lists a task completed at 23:30 New York on Nov 9 in the done group of Nov 9 for a Tokyo request, as for New York', async () => {
  const app = start();
  await clock(app, '2026-11-09T15:00:00.000Z');
  const id = await create(app, 'Report');
  await clock(app, '2026-11-10T04:30:00.000Z');
  await send(app, 'POST', `/api/tasks/${id}/complete`);
  await clock(app, '2026-11-10T15:00:00.000Z');

  expect(
    await historyDone(app, '2026-11-09', '2026-11-09', 'America/New_York'),
  ).toEqual([id]);
  expect(
    await historyDone(app, '2026-11-09', '2026-11-09', 'Asia/Tokyo'),
  ).toEqual([id]);
});

it('keeps a task completed and moved to the backlog today out of the Today list but in the done group of today', async () => {
  const app = start();
  await clock(app, '2026-11-10T14:00:00.000Z');
  const id = await create(app, 'Report');
  await send(app, 'POST', `/api/tasks/${id}/complete`);
  await clock(app, '2026-11-10T15:00:00.000Z');
  await send(app, 'POST', `/api/tasks/${id}/move-to-backlog`);

  const view = await todayView(app);
  expect([...view.open, ...view.done].map((t) => t.id)).not.toContain(id);
  expect(await historyDone(app, '2026-11-09', '2026-11-10')).toEqual([id]);
});
