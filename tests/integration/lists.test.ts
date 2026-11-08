import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
function start() {
  const app = testApp();
  apps.push(app);
  return app;
}
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

type App = ReturnType<typeof testApp>;
const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
type List = { id: string; name: string; color: string; position: number };
type Task = { id: string; listId: string | null };

async function listByName(app: App, name: string) {
  const { lists } = (await (await app.request('/api/lists')).json()) as {
    lists: List[];
  };
  const list = lists.find((item) => item.name === name);
  if (!list) throw new Error(`Missing seeded list ${name}`);
  return list;
}
async function createTask(app: App, title: string, listId?: string) {
  const response = await app.request(
    '/api/tasks',
    send('POST', { title, target: 'backlog', ...(listId ? { listId } : {}) }),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { task: Task }).task;
}

it('creates a list with the default Purple color last, rejects a duplicate name ignoring case, and rejects an invalid color', async () => {
  const app = start();
  const created = await app.request(
    '/api/lists',
    send('POST', { name: 'Errands' }),
  );
  expect(created.status).toBe(201);
  const { list } = (await created.json()) as { list: List };
  expect(list).toMatchObject({
    name: 'Errands',
    color: '#8E7CC3',
    position: 3,
  });

  const duplicate = await app.request(
    '/api/lists',
    send('POST', { name: 'work' }),
  );
  expect(duplicate.status).toBe(409);
  expect(
    ((await duplicate.json()) as { error: { code: string } }).error.code,
  ).toBe('list_exists');

  const invalid = await app.request(
    `/api/lists/${list.id}`,
    send('PATCH', { color: '#000000' }),
  );
  expect(invalid.status).toBe(400);
  expect(
    ((await invalid.json()) as { error: { code: string } }).error.code,
  ).toBe('invalid_color');
});

it('deletes a list and leaves its tasks without a list', async () => {
  const app = start();
  const work = await listByName(app, 'Work');
  const first = await createTask(app, 'Write report');
  const second = await createTask(app, 'Book review');
  for (const task of [first, second]) {
    const patched = await app.request(
      `/api/tasks/${task.id}`,
      send('PATCH', { listId: work.id }),
    );
    expect(patched.status).toBe(200);
  }

  const deleted = await app.request(`/api/lists/${work.id}`, {
    method: 'DELETE',
  });
  expect(deleted.status).toBe(204);

  for (const task of [first, second]) {
    const response = await app.request(`/api/tasks/${task.id}`);
    expect(((await response.json()) as { task: Task }).task.listId).toBeNull();
  }
});

it('filters the backlog by listId and creates a task in the given list', async () => {
  const app = start();
  const home = await listByName(app, 'Home');
  const work = await listByName(app, 'Work');
  await createTask(app, 'Write report', work.id);
  const shelf = await createTask(app, 'Fix the shelf', home.id);
  expect(shelf.listId).toBe(home.id);

  const response = await app.request(`/api/views/backlog?listId=${home.id}`);
  const { tasks } = (await response.json()) as { tasks: Task[] };
  expect(tasks.map((task) => task.id)).toEqual([shelf.id]);
});
