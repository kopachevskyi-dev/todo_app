import { expect, it } from 'vitest';
import { examples, upcomingResponseSchema } from '../../src/shared/contract';
import { lists, tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';
import { exampleInstant, setClock } from '../helpers/contract-fixture';

it('parses the upcoming example with the client schema', () => {
  expect(upcomingResponseSchema.parse(examples.upcoming)).toEqual(
    examples.upcoming,
  );
});

it('returns the upcoming example for the same fixture', async () => {
  const app = testApp({ testClock: true });
  try {
    await setClock(app, exampleInstant);
    const example = upcomingResponseSchema.parse(examples.upcoming);
    const rows = example.days.flatMap(({ tasks: dayTasks }) => dayTasks);
    for (const { list } of rows)
      if (list)
        app.database.db
          .insert(lists)
          .values({ ...list, createdAt: rows[0]!.createdAt })
          .onConflictDoNothing()
          .run();
    app.database.db
      .insert(tasks)
      .values(
        rows.map((t) => ({
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
    const result = await app.request('/api/upcoming');
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(examples.upcoming);
  } finally {
    app.close();
  }
});
