import { afterEach, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../src/web/api';
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

const id = examples.createTaskResponse.task.id;
const responseCalls: Record<string, () => Promise<unknown>> = {
  health: () => api.health(),
  lists: () => api.lists(),
  clock: () => api.clock(),
  today: () => api.today(),
  todayOrderResponse: () =>
    api.setTodayOrder([...examples.todayOrderRequest.taskIds]),
  upcoming: () => api.upcoming(),
  createTaskResponse: () => api.createTask(examples.createTaskRequest),
  dayLoad: () => api.dayLoad('from', 'to'),
  history: () => api.history('week'),
  taskDetail: () => api.task(id),
};
const requestCalls: Record<string, () => Promise<unknown>> = {
  createTaskRequest: () => api.createTask(examples.createTaskRequest),
  planTaskRequest: () => api.planTask(id, examples.planTaskRequest.day),
  todayOrderRequest: () =>
    api.setTodayOrder([...examples.todayOrderRequest.taskIds]),
};
const errorExamples = ['error', 'dayInPastError', 'notInBacklogError'] as const;

it('covers every shared example with a client API call', () => {
  expect(
    [
      ...Object.keys(responseCalls),
      ...Object.keys(requestCalls),
      ...errorExamples,
    ].sort(),
  ).toEqual(Object.keys(examples).sort());
});

it.each(Object.entries(responseCalls))(
  'the client API parses the %s example',
  async (name, call) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(examples[name as keyof typeof examples]),
        ),
    );
    expect(await call()).toEqual(examples[name as keyof typeof examples]);
  },
);

it.each(errorExamples)(
  'the client API surfaces the %s example',
  async (name) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(examples[name], {
          status: name === 'notInBacklogError' ? 409 : 400,
        }),
      ),
    );
    const response = api.health();
    await expect(response).rejects.toThrow(examples[name].error.message);
    if (name === 'notInBacklogError') {
      await expect(response).rejects.toBeInstanceOf(ApiError);
      await expect(response).rejects.toMatchObject({
        status: 409,
        details: {
          code: examples.notInBacklogError.error.code,
          taskIds: examples.notInBacklogError.error.taskIds,
        },
      });
    }
  },
);

it.each(Object.entries(requestCalls))(
  'the client API sends the %s example as the request body',
  async (name, call) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          name === 'todayOrderRequest'
            ? examples.todayOrderResponse
            : examples.createTaskResponse,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await call();
    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(init.body)).toEqual(
      examples[name as keyof typeof examples],
    );
  },
);
