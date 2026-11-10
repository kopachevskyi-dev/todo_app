import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

it('creates directly with a list and explicit future day, or an explicit null day', async () => {
  const app = testApp();
  apps.push(app);
  const { lists } = await (await app.request('/api/lists')).json();
  const listId = lists[0].id;
  const response = await app.request(
    '/api/tasks',
    json({ title: 'Dentist', target: 'today', listId, day: '2026-11-11' }),
  );
  expect(response.status).toBe(201);
  const { task } = await response.json();
  expect(task).toMatchObject({ title: 'Dentist', listId, day: '2026-11-11' });
  const detail = await (await app.request(`/api/tasks/${task.id}`)).json();
  expect(detail.activity).toMatchObject([
    { type: 'planned', day: '2026-11-11' },
  ]);
  const today = await (await app.request('/api/views/today')).json();
  expect(today.open.some((row: { id: string }) => row.id === task.id)).toBe(
    false,
  );
  const backlogResponse = await app.request(
    '/api/tasks',
    json({ title: 'Unscheduled', target: 'today', day: null }),
  );
  expect(backlogResponse.status).toBe(201);
  expect(await backlogResponse.json()).toMatchObject({ task: { day: null } });
});

it.each(['2026-11-03', 'not-a-date'])(
  'rejects invalid capture day %s without creating a task',
  async (day) => {
    const app = testApp();
    apps.push(app);
    const response = await app.request(
      '/api/tasks',
      json({ title: 'Invalid date', target: 'backlog', day }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: day === 'not-a-date' ? 'invalid_request' : 'day_in_past' },
    });
    expect(
      await (await app.request('/api/views/backlog')).json(),
    ).toMatchObject({ tasks: [] });
  },
);
