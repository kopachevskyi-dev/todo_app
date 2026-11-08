import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

it('returns actionable errors for invalid list mutations and missing lists', async () => {
  const app = testApp();
  apps.push(app);
  const { lists } = (await (await app.request('/api/lists')).json()) as {
    lists: { id: string; name: string }[];
  };
  const work = lists.find((list) => list.name === 'Work')!;
  for (const [path, method, body, status, code] of [
    ['/api/lists', 'POST', { name: '   ' }, 400, 'invalid_request'],
    ['/api/lists', 'POST', { name: 'x'.repeat(41) }, 400, 'invalid_request'],
    [
      `/api/lists/${work.id}`,
      'PATCH',
      { name: ' personal ' },
      409,
      'list_exists',
    ],
    ['/api/lists/missing', 'PATCH', { name: 'Missing' }, 404, 'not_found'],
    ['/api/lists/missing', 'DELETE', undefined, 404, 'not_found'],
    [
      '/api/tasks',
      'POST',
      {
        title: 'Test',
        target: 'backlog',
        listId: '01JBX0000000000000000AAAAA',
      },
      400,
      'invalid_list',
    ],
  ] as const) {
    const response = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.status).toBe(status);
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe(code);
  }
});
