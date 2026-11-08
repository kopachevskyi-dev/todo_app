import { expect, it } from 'vitest';
import { testApp } from '../helpers/app';

it('rejects reopening an open task without recording a reopened event', async () => {
  const app = testApp();
  try {
    const created = await app.request('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Still open', target: 'today' }),
    });
    const { task } = (await created.json()) as { task: { id: string } };
    const response = await app.request(`/api/tasks/${task.id}/reopen`, {
      method: 'POST',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'not_done' },
    });
    const detail = await (await app.request(`/api/tasks/${task.id}`)).json();
    expect(detail).toMatchObject({ task: { completedAt: null } });
    expect(
      (detail as { activity: { type: string }[] }).activity.map(
        (event) => event.type,
      ),
    ).toEqual(['added_to_today']);
  } finally {
    app.close();
  }
});

it.each(['complete', 'reopen'])(
  'returns not_found for %s of a missing task',
  async (action) => {
    const app = testApp();
    try {
      const response = await app.request(
        `/api/tasks/01JBY1000000000000000000AB/${action}`,
        { method: 'POST' },
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: { code: 'not_found' },
      });
    } finally {
      app.close();
    }
  },
);
