import { expect, it } from 'vitest';
import {
  createTaskResponseSchema,
  dayLoadResponseSchema,
  errorResponseSchema,
  examples,
  planTaskRequestSchema,
} from '../../src/shared/contract';
import { tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';
import {
  dayBeforeExample,
  exampleInstant,
  jsonRequest,
  setClock,
} from '../helpers/contract-fixture';

const taskId = examples.createTaskResponse.task.id;
const created = examples.createTaskResponse.task.createdAt;

function insertTask(
  app: ReturnType<typeof testApp>,
  id: string,
  day: string | null,
) {
  app.database.db
    .insert(tasks)
    .values({
      id,
      title: 'x',
      day,
      placedAt: created,
      createdAt: created,
      updatedAt: created,
    })
    .run();
}

it('parses the plan request, past-day error and day-load examples with the shared schemas', () => {
  expect(planTaskRequestSchema.parse(examples.planTaskRequest)).toEqual(
    examples.planTaskRequest,
  );
  expect(errorResponseSchema.parse(examples.dayInPastError)).toEqual(
    examples.dayInPastError,
  );
  expect(dayLoadResponseSchema.parse(examples.dayLoad)).toEqual(
    examples.dayLoad,
  );
});

it('accepts the plan request example and returns the past-day error example', async () => {
  const app = testApp({ testClock: true });
  try {
    await setClock(app, exampleInstant);
    insertTask(app, taskId, null);
    const past = await app.request(
      `/api/tasks/${taskId}/plan`,
      jsonRequest('POST', { day: dayBeforeExample }),
    );
    expect(past.status).toBe(400);
    expect(await past.json()).toEqual(examples.dayInPastError);

    const planned = await app.request(
      `/api/tasks/${taskId}/plan`,
      jsonRequest('POST', examples.planTaskRequest),
    );
    expect(planned.status).toBe(200);
    expect(createTaskResponseSchema.parse(await planned.json()).task.day).toBe(
      examples.planTaskRequest.day,
    );
  } finally {
    app.close();
  }
});

it('returns the day-load example in full for a fixture with the example counts', async () => {
  const app = testApp({ testClock: true });
  try {
    await setClock(app, exampleInstant);
    const days = Object.keys(examples.dayLoad.days).sort();
    let n = 0;
    for (const [day, count] of Object.entries(examples.dayLoad.days))
      for (let i = 0; i < count; i++)
        insertTask(app, `01JBZ${String(++n).padStart(21, '0')}`, day);
    const load = await app.request(
      `/api/day-load?from=${days[0]}&to=${days[days.length - 1]}`,
    );
    expect(load.status).toBe(200);
    expect(await load.json()).toEqual(examples.dayLoad);
  } finally {
    app.close();
  }
});

it('parses the not_in_backlog example with the shared error schema, keeping taskIds', () => {
  expect(errorResponseSchema.parse(examples.notInBacklogError)).toEqual(
    examples.notInBacklogError,
  );
});

it('returns the not_in_backlog example when a requested task is already planned', async () => {
  const app = testApp({ testClock: true });
  try {
    await setClock(app, exampleInstant);
    const planned = examples.notInBacklogError.error.taskIds[0];
    insertTask(app, taskId, null);
    insertTask(app, planned, examples.planTaskRequest.day);
    const response = await app.request(
      '/api/tasks/plan-today',
      jsonRequest('POST', { taskIds: [taskId, planned] }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(examples.notInBacklogError);
  } finally {
    app.close();
  }
});
