import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

it('rejects invalid subtask patches without changing the stored subtask', async () => {
  const app = testApp();
  apps.push(app);
  const send = (path: string, body: unknown) =>
    app.request(path, {
      method: path.startsWith('/api/subtasks/') ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const { task } = (await (
    await send('/api/tasks', { title: 'Task', target: 'backlog' })
  ).json()) as { task: { id: string } };
  const { subtask } = (await (
    await send(`/api/tasks/${task.id}/subtasks`, { title: 'Original' })
  ).json()) as { subtask: { id: string } };
  for (const title of ['', '   ', 'x'.repeat(201)]) {
    const response = await send(`/api/subtasks/${subtask.id}`, { title });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_title' },
    });
  }
  const invalidDone = await send(`/api/subtasks/${subtask.id}`, {
    done: 'true',
  });
  expect(invalidDone.status).toBe(400);
  expect(await invalidDone.json()).toMatchObject({
    error: { code: 'invalid_request' },
  });
  expect(
    await (await app.request(`/api/tasks/${task.id}`)).json(),
  ).toMatchObject({ subtasks: [{ title: 'Original', done: false }] });
});

it('returns 404 when patching or deleting an unknown subtask', async () => {
  const app = testApp();
  apps.push(app);
  for (const method of ['PATCH', 'DELETE']) {
    const response = await app.request(
      '/api/subtasks/01JBX7Q3M2V8R4K9T6N0P1S5WZ',
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'PATCH' ? { body: JSON.stringify({ done: true }) } : {}),
      },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'not_found' },
    });
  }
});
