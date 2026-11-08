import { expect, it } from 'vitest';
import {
  createTaskRequestSchema,
  createTaskResponseSchema,
} from '../../src/shared/contract';
import { testApp } from '../helpers/app';

const request = { title: "Renew driver's license", target: 'backlog' };
const response = {
  task: {
    id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
    title: "Renew driver's license",
    description: '',
    listId: null,
    day: null,
    completedAt: null,
    missedFrom: null,
    subtaskCount: 0,
    subtaskDoneCount: 0,
    createdAt: '2026-11-02T14:12:00.000Z',
    updatedAt: '2026-11-02T14:12:00.000Z',
  },
};

it('accepts the create-task request example and parses the response example', () => {
  expect(createTaskRequestSchema.parse(request)).toEqual(request);
  expect(createTaskResponseSchema.parse(response)).toEqual(response);
});

it('returns a create-task response that matches the response schema', async () => {
  const app = await testApp();
  try {
    const result = await app.request('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(result.status).toBe(201);
    const body = createTaskResponseSchema.parse(await result.json());
    expect(body.task).toMatchObject({
      title: "Renew driver's license",
      description: '',
      listId: null,
      day: null,
      completedAt: null,
      missedFrom: null,
      subtaskCount: 0,
      subtaskDoneCount: 0,
    });
  } finally {
    await app.close();
  }
});
