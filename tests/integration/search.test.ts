import { afterEach, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { tasks } from '../../src/persistence/schema';

const apps: ReturnType<typeof testApp>[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.close();
});

it('returns at most 50 of 60 matches, newest updatedAt first', async () => {
  const app = testApp();
  apps.push(app);
  const rows = Array.from({ length: 60 }, (_, i) => {
    const n = String(i).padStart(2, '0');
    const at = `2026-11-01T10:${n}:00.000Z`;
    return {
      id: `01JBX7Q3M2V8R4K9T6N0P1S${n}`.slice(0, 26),
      title: `Task a${n}`,
      placedAt: at,
      createdAt: at,
      updatedAt: at,
    };
  });
  app.database.db.insert(tasks).values(rows).run();

  const response = await app.request('/api/search?q=a');
  expect(response.status).toBe(200);
  const { results } = (await response.json()) as {
    results: { updatedAt: string; location: unknown }[];
  };
  expect(results).toHaveLength(50);
  const expected = rows
    .map((row) => row.updatedAt)
    .reverse()
    .slice(0, 50);
  expect(results.map((result) => result.updatedAt)).toEqual(expected);
  expect(results[0]?.location).toEqual({ kind: 'backlog', day: null });
});

it('rejects an empty query with invalid_query', async () => {
  const app = testApp();
  apps.push(app);
  const response = await app.request('/api/search?q=');
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: 'invalid_query' },
  });
});
