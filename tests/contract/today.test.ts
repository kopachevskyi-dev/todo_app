import { expect, it } from 'vitest';
import { todayResponseSchema } from '../../src/shared/contract';
import { tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';

const personal = {
  id: '01JBX0000000000000000PERSN',
  name: 'Personal',
  color: '#E3686A',
  position: 0,
};
// The ticket's example, completed with the fields TaskRow requires and made
// self-consistent (valid ULID, progress matching the two rows).
const example = {
  day: '2026-11-04',
  open: [
    {
      id: '01JBY1000000000000000000AB',
      title: 'Call the dentist',
      description: '',
      listId: null,
      list: null,
      day: '2026-11-04',
      completedAt: null,
      missedFrom: null,
      subtaskCount: 0,
      subtaskDoneCount: 0,
      createdAt: '2026-11-04T14:00:00.000Z',
      updatedAt: '2026-11-04T14:00:00.000Z',
    },
  ],
  done: [
    {
      id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
      title: "Renew driver's license",
      description: '',
      listId: personal.id,
      list: personal,
      day: '2026-11-04',
      completedAt: '2026-11-04T19:20:00.000Z',
      missedFrom: null,
      subtaskCount: 0,
      subtaskDoneCount: 0,
      createdAt: '2026-11-02T14:12:00.000Z',
      updatedAt: '2026-11-04T19:20:00.000Z',
    },
  ],
  progress: { done: 1, total: 2 },
};

it('parses the today example with the client schema', () => {
  expect(todayResponseSchema.parse(example)).toEqual(example);
});

it('returns the today example for the same fixture, matching the schema', async () => {
  const app = testApp();
  try {
    app.database.db
      .insert(tasks)
      .values(
        [...example.open, ...example.done].map((t) => ({
          id: t.id,
          title: t.title,
          listId: t.listId,
          day: t.day,
          completedAt: t.completedAt,
          placedAt: t.createdAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      )
      .run();
    const result = await app.request('/api/views/today');
    expect(result.status).toBe(200);
    expect(todayResponseSchema.parse(await result.json())).toEqual(example);
  } finally {
    app.close();
  }
});
