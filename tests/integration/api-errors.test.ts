import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});
const json = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

it('answers an unknown task id with 404 not_found', async () => {
  const app = testApp();
  apps.push(app);
  const response = await app.request('/api/tasks/01JXXXXXXXXXXXXXXXXXXXXXXX');
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: { code: 'not_found' } });
});

it('answers a nonexistent listId with the same 400 code on POST and PATCH', async () => {
  const app = testApp();
  apps.push(app);
  const listId = '01JBX0000000000000000AAAAA';
  const created = await app.request(
    '/api/tasks',
    json('POST', { title: 'Task', target: 'backlog' }),
  );
  const { task } = (await created.json()) as { task: { id: string } };

  const post = await app.request(
    '/api/tasks',
    json('POST', { title: 'Other', target: 'backlog', listId }),
  );
  const patch = await app.request(
    `/api/tasks/${task.id}`,
    json('PATCH', { listId }),
  );
  expect(post.status).toBe(400);
  expect(patch.status).toBe(400);
  const code = async (r: Response) =>
    ((await r.json()) as { error: { code: string } }).error.code;
  expect(await code(patch)).toBe(await code(post));
});
