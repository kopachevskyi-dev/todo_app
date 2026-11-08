import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../src/web/api';
import { examples } from '../../src/shared/contract';

afterEach(() => vi.unstubAllGlobals());

it('sends the browser timezone on each API request and parses shared responses', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(examples.health))
    .mockResolvedValueOnce(Response.json(examples.lists));
  vi.stubGlobal('fetch', fetchMock);
  expect(await api.health()).toEqual(examples.health);
  expect(await api.lists()).toEqual(examples.lists);
  expect(fetchMock.mock.calls).toEqual([
    [
      '/api/health',
      {
        headers: {
          'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    ],
    [
      '/api/lists',
      {
        headers: {
          'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    ],
  ]);
});

it('parses API errors and rejects invalid success payloads', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(examples.error, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ ok: false })),
  );
  await expect(api.health()).rejects.toThrow(examples.error.error.message);
  await expect(api.health()).rejects.toThrow();
});
