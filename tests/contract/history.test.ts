import { expect, it } from 'vitest';
import { examples, historyResponseSchema } from '../../src/shared/contract';
import { testApp } from '../helpers/app';
import { jsonRequest } from '../helpers/contract-fixture';
import { LICENSE, seedHistoryWeek } from '../helpers/history-fixture';

it('parses the history example with the client schema', () => {
  expect(historyResponseSchema.parse(examples.history)).toEqual(
    examples.history,
  );
});

it('returns the full history example, including day groups, for the fixture week', async () => {
  const app = testApp({ testClock: true });
  try {
    const ids = await seedHistoryWeek((method, path, body) =>
      app.request(
        path,
        body === undefined ? { method } : jsonRequest(method, body),
      ),
    );
    const example = historyResponseSchema.parse(examples.history);
    const exampleTasks = example.days.flatMap(({ groups }) =>
      Object.values(groups).flat(),
    );
    const license = exampleTasks.find((task) => task.title === LICENSE);
    const patched = await app.request(
      `/api/tasks/${ids[LICENSE]}`,
      jsonRequest('PATCH', { listId: license?.listId }),
    );
    expect(patched.status).toBe(200);

    const response = await app.request(
      `/api/views/history?weekStart=${example.weekStart}`,
    );
    expect(response.status).toBe(200);
    const body = historyResponseSchema.parse(await response.json());
    // Task ids are generated per run: map them to the example's by title.
    const idByTitle = new Map(exampleTasks.map((t) => [t.title, t.id]));
    const fixed = JSON.parse(JSON.stringify(body)) as typeof body;
    for (const { groups } of fixed.days)
      for (const task of Object.values(groups).flat())
        task.id = idByTitle.get(task.title) ?? task.id;
    expect(fixed).toEqual(example);
  } finally {
    app.close();
  }
});
