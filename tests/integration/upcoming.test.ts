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

async function create(app: App, title: string, day: string | null) {
  const response = await send(app, 'POST', '/api/tasks', {
    title,
    target: 'backlog',
  });
  const id = ((await response.json()) as { task: { id: string } }).task.id;
  if (day) await send(app, 'POST', `/api/tasks/${id}/plan`, { day });
  return id;
}

it('groups future tasks by day ascending on Tue Nov 10 in New York, leaving out today and the backlog', async () => {
  const app = testApp({ testClock: true });
  apps.push(app);
  await send(app, 'PUT', '/api/test/clock', { now: '2026-11-10T14:00:00Z' });
  const today = await create(app, 'Today task', '2026-11-10');
  const nov17 = await create(app, 'Dentist', '2026-11-17');
  const first = await create(app, 'Call mom', '2026-11-11');
  const second = await create(app, 'Pay rent', '2026-11-11');
  await create(app, 'Someday', null);

  const response = await app.request('/api/upcoming');
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    days: { day: string; tasks: { id: string }[] }[];
  };
  expect(body.days.map((d) => d.day)).toEqual(['2026-11-11', '2026-11-17']);
  expect(body.days[0]!.tasks.map((t) => t.id).sort()).toEqual(
    [first, second].sort(),
  );
  expect(body.days[1]!.tasks.map((t) => t.id)).toEqual([nov17]);
  expect(JSON.stringify(body)).not.toContain(today);
});
