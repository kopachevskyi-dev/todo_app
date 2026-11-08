import { afterEach, describe, expect, it, vi } from 'vitest';
import { testApp } from '../helpers/app';
import {
  clockSchema,
  errorResponseSchema,
  listsResponseSchema,
} from '../../src/shared/contract';

const apps: Awaited<ReturnType<typeof testApp>>[] = [];
async function start(options: Parameters<typeof testApp>[0] = {}) {
  const app = await testApp(options);
  apps.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

it('migrates a fresh SQLite file and returns exactly the seeded lists in order', async () => {
  const app = await start();
  const response = await app.request('/api/lists');
  expect(response.status).toBe(200);
  const body = listsResponseSchema.parse(await response.json());
  expect(
    body.lists.map(({ name, color, position }) => ({ name, color, position })),
  ).toEqual([
    { name: 'Personal', color: '#E3686A', position: 0 },
    { name: 'Work', color: '#5FB4C6', position: 1 },
    { name: 'Home', color: '#F0C24B', position: 2 },
  ]);
});

describe('timezone middleware applies to every API request', () => {
  it.each([
    '/api',
    '/api/health',
    '/api/lists',
    '/api/test/clock',
    '/api/unknown',
  ])('rejects missing and invalid timezone at %s', async (path) => {
    const app = await start();
    const headerCases: HeadersInit[] = [
      {},
      { 'X-Timezone': 'Mars/Base' },
      { 'X-Timezone': '+02:00' },
    ];
    for (const headers of headerCases) {
      const response = await app.rawRequest(path, { headers });
      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(await response.json()).error.code).toBe(
        'invalid_timezone',
      );
    }
  });
});

it('serves health and returns the common error shape for an unknown route', async () => {
  const app = await start();
  expect(await (await app.request('/api/health')).json()).toEqual({
    ok: true,
  });
  for (const path of ['/api', '/api/unknown']) {
    const response = await app.request(path);
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe(
      'not_found',
    );
  }
});

it('hides both clock routes unless explicitly enabled', async () => {
  const app = await start();
  for (const method of ['GET', 'PUT']) {
    const response = await app.request('/api/test/clock', { method });
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe(
      'not_found',
    );
  }
});

it('sets the injected clock and uses it on a subsequent request', async () => {
  const app = await start({ testClock: true });
  const now = '2026-11-05T01:00:00.000Z';
  const response = await app.request('/api/test/clock', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ now }),
  });
  expect(response.status).toBe(200);
  expect(clockSchema.parse(await response.json())).toEqual({ now });
  expect(
    clockSchema.parse(await (await app.request('/api/test/clock')).json()),
  ).toEqual({ now });
});

it('rejects malformed clock input and preserves the clock', async () => {
  const app = await start({ testClock: true });
  for (const body of [
    '{',
    '{"now":"tomorrow"}',
    '{"now":"2026-02-30T00:00:00Z"}',
  ]) {
    const response = await app.request('/api/test/clock', {
      method: 'PUT',
      body,
    });
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe(
      'invalid_request',
    );
  }
  expect(await (await app.request('/api/test/clock')).json()).toEqual({
    now: '2026-11-04T19:20:00.000Z',
  });
});

it('logs an unknown failure and returns a 500 without internals', async () => {
  const logError = vi.fn();
  const app = await start({ logError });
  app.database.db.run('DROP TABLE list');
  const response = await app.request('/api/lists');
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: 'internal_error', message: 'An unexpected error occurred.' },
  });
  expect(logError).toHaveBeenCalledOnce();
});
