import { expect, it } from 'vitest';
import {
  createTaskRequestSchema,
  createTaskResponseSchema,
  examples,
} from '../../src/shared/contract';
import { testApp } from '../helpers/app';
import { jsonRequest, setClock } from '../helpers/contract-fixture';

it('accepts the create-task request example and parses the response example', () => {
  expect(createTaskRequestSchema.parse(examples.createTaskRequest)).toEqual(
    examples.createTaskRequest,
  );
  expect(createTaskResponseSchema.parse(examples.createTaskResponse)).toEqual(
    examples.createTaskResponse,
  );
});

it('returns the create-task response example for the request example', async () => {
  const app = testApp({ testClock: true });
  try {
    await setClock(app, examples.createTaskResponse.task.createdAt);
    const result = await app.request(
      '/api/tasks',
      jsonRequest('POST', examples.createTaskRequest),
    );
    expect(result.status).toBe(201);
    const body = createTaskResponseSchema.parse(await result.json());
    expect({
      task: { ...body.task, id: examples.createTaskResponse.task.id },
    }).toEqual(examples.createTaskResponse);
  } finally {
    app.close();
  }
});
