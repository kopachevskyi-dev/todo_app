import { expect, it } from 'vitest';
import { examples, todayResponseSchema } from '../../src/shared/contract';
import { tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';
import { exampleInstant, setClock } from '../helpers/contract-fixture';

it('parses the today example with the client schema', () => {
  expect(todayResponseSchema.parse(examples.today)).toEqual(examples.today);
});

it('returns the today example for the same fixture', async () => {
  const app = testApp({ testClock: true });
  try {
    await setClock(app, exampleInstant);
    const example = todayResponseSchema.parse(examples.today);
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
    expect(await result.json()).toEqual(examples.today);
    expect(example.day).toBe(exampleInstant.slice(0, 10));
  } finally {
    app.close();
  }
});
