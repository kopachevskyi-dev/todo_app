import { expect, it } from 'vitest';
import { historyResponseSchema } from '../../src/shared/contract';
import { testApp } from '../helpers/app';
import { seedHistoryWeek } from '../helpers/history-fixture';

// The ticket's example (one of the 7 days), with a valid ULID for the
// not-done task.
const example = {
  weekStart: '2026-11-02',
  today: '2026-11-08',
  days: [
    {
      day: '2026-11-04',
      done: 4,
      notDone: 1,
      planned: 0,
      groups: {
        done: [
          {
            id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
            title: "Renew driver's license",
            listId: '01JBX0000000000000000PERSN',
            completedAt: '2026-11-04T19:20:00.000Z',
          },
        ],
        notDone: [
          {
            id: '01JBY1000000000000000000AB',
            title: 'Call the dentist',
            listId: null,
            movedTo: 'backlog',
          },
        ],
        planned: [],
      },
    },
  ],
};

it('parses the history example with the client schema', () => {
  expect(historyResponseSchema.parse(example)).toEqual(example);
});

it('returns history for the fixture week matching the schema', async () => {
  const app = testApp({ testClock: true });
  try {
    await seedHistoryWeek((method, path, body) =>
      app.request(
        path,
        body === undefined
          ? { method }
          : {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
      ),
    );
    const response = await app.request(
      '/api/views/history?weekStart=2026-11-02',
    );
    expect(response.status).toBe(200);
    const parsed = historyResponseSchema.parse(await response.json());
    expect(parsed).toMatchObject({
      weekStart: '2026-11-02',
      today: '2026-11-08',
    });
  } finally {
    app.close();
  }
});
