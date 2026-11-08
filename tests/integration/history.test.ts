import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import {
  LICENSE,
  seedHistoryWeek,
  type Send,
} from '../helpers/history-fixture';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

async function seeded() {
  const app = testApp({ testClock: true });
  apps.push(app);
  const send: Send = (method, path, body) =>
    app.request(
      path,
      body === undefined
        ? { method }
        : {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
    );
  const ids = await seedHistoryWeek(send);
  return { app, send, ids };
}

type Day = {
  day: string;
  done: number;
  notDone: number;
  planned: number;
  groups: {
    done: { id: string }[];
    notDone: { id: string }[];
    planned: { id: string }[];
  };
};
const history = async (app: ReturnType<typeof testApp>, weekStart: string) =>
  (await (
    await app.request(`/api/views/history?weekStart=${weekStart}`)
  ).json()) as { days: Day[] };

describe('GET /api/views/history', () => {
  it('returns done and not done per day for the Nov 2-8 fixture on Sun Nov 8, and rejects a non-Monday week', async () => {
    const { app } = await seeded();

    const response = await app.request(
      '/api/views/history?weekStart=2026-11-02',
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { days: Day[] };
    expect(body.days.map((d) => [d.day, d.done, d.notDone, d.planned])).toEqual(
      [
        ['2026-11-02', 3, 0, 0],
        ['2026-11-03', 4, 1, 0],
        ['2026-11-04', 4, 1, 0],
        ['2026-11-05', 3, 1, 0],
        ['2026-11-06', 2, 0, 0],
        ['2026-11-07', 0, 0, 0],
        ['2026-11-08', 1, 0, 2],
      ],
    );

    const invalid = await app.request(
      '/api/views/history?weekStart=2026-11-03',
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: { code: 'invalid_week' },
    });
  });

  it('lists a task planned for Nov 12 under planned in the week of Nov 9', async () => {
    const { app, send } = await seeded();
    const created = (await (
      await send('POST', '/api/tasks', {
        title: 'Book flights',
        target: 'backlog',
      })
    ).json()) as { task: { id: string } };
    await send('POST', `/api/tasks/${created.task.id}/plan`, {
      day: '2026-11-12',
    });

    const body = await history(app, '2026-11-09');
    const nov12 = body.days.find((d) => d.day === '2026-11-12')!;
    expect(nov12.planned).toBe(1);
    expect(nov12.groups.planned.map((t) => t.id)).toEqual([created.task.id]);
  });
});

describe('POST /api/tasks/:id/move-to-backlog', () => {
  it('puts a done task in the backlog while Nov 4 still lists it as done, and rejects an open task with 409 not_done', async () => {
    const { app, send, ids } = await seeded();

    const moved = await send(
      'POST',
      `/api/tasks/${ids[LICENSE]}/move-to-backlog`,
    );
    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({
      task: { id: ids[LICENSE], completedAt: null, day: null },
    });
    const backlog = (await (
      await app.request('/api/views/backlog')
    ).json()) as {
      tasks: { id: string }[];
    };
    expect(backlog.tasks.map((t) => t.id)).toContain(ids[LICENSE]);
    const wed = (await history(app, '2026-11-02')).days.find(
      (d) => d.day === '2026-11-04',
    )!;
    expect(wed.groups.done.map((t) => t.id)).toContain(ids[LICENSE]);

    const open = await send(
      'POST',
      `/api/tasks/${ids['Sun open 1']}/move-to-backlog`,
    );
    expect(open.status).toBe(409);
    expect(await open.json()).toMatchObject({ error: { code: 'not_done' } });
  });
});
