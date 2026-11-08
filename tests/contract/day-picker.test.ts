import { expect, it } from 'vitest';
import {
  dayLoadResponseSchema,
  errorResponseSchema,
  planTaskRequestSchema,
} from '../../src/shared/contract';
import { tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';

const planRequest = { day: '2026-11-04' };
const pastError = {
  error: { code: 'day_in_past', message: 'Choose today or a later day.' },
};
const dayLoad = {
  days: {
    '2026-11-03': 5,
    '2026-11-04': 4,
    '2026-11-05': 0,
    '2026-11-06': 2,
    '2026-11-07': 0,
  },
};

it('parses the plan request, error and day-load examples with the shared schemas', () => {
  expect(planTaskRequestSchema.parse(planRequest)).toEqual(planRequest);
  expect(planTaskRequestSchema.parse({ day: null })).toEqual({ day: null });
  expect(errorResponseSchema.parse(pastError)).toEqual(pastError);
  expect(dayLoadResponseSchema.parse(dayLoad)).toEqual(dayLoad);
});

it('the server returns the past-day error and a day-load body matching the examples', async () => {
  const app = testApp();
  try {
    // fixedClock: 2026-11-04T19:20Z = Wed Nov 4 in New York
    const created = '2026-11-02T14:12:00.000Z';
    const id = '01JBX7Q3M2V8R4K9T6N0P1S5WZ';
    app.database.db
      .insert(tasks)
      .values({
        id,
        title: 'x',
        placedAt: created,
        createdAt: created,
        updatedAt: created,
      })
      .run();
    const past = await app.request(`/api/tasks/${id}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: '2026-11-03' }),
    });
    expect(past.status).toBe(400);
    expect(await past.json()).toEqual(pastError);

    const load = await app.request(
      '/api/day-load?from=2026-11-03&to=2026-11-07',
    );
    expect(load.status).toBe(200);
    const body: unknown = await load.json();
    const parsed = dayLoadResponseSchema.parse(body);
    expect(Object.keys(parsed.days)).toEqual(Object.keys(dayLoad.days));
  } finally {
    app.close();
  }
});
