import { expect, it } from 'vitest';
import { taskDetailResponseSchema } from '../../src/shared/contract';
import { taskEvents, tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';

const example = {
  task: {
    id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
    title: "Renew driver's license",
    description:
      'Bring the old license, a passport photo and proof of address.',
    listId: '01JBX0000000000000000PERSN',
    day: null,
    completedAt: null,
    missedFrom: null,
    subtaskCount: 0,
    subtaskDoneCount: 0,
    createdAt: '2026-11-02T14:12:00.000Z',
    updatedAt: '2026-11-04T01:03:00.000Z',
  },
  subtasks: [],
  activity: [
    {
      type: 'added_to_backlog',
      at: '2026-11-02T14:12:00.000Z',
      day: null,
      text: 'added to backlog',
    },
    {
      type: 'details_added',
      at: '2026-11-04T01:03:00.000Z',
      day: null,
      text: 'description and list added',
    },
  ],
};

it('parses the detail example with the client schema', () => {
  expect(taskDetailResponseSchema.parse(example)).toEqual(example);
});

it('returns the detail example for the same fixture, matching the schema', async () => {
  const app = testApp();
  try {
    const { task } = example;
    app.database.db
      .insert(tasks)
      .values({
        id: task.id,
        title: task.title,
        description: task.description,
        listId: task.listId,
        placedAt: task.createdAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })
      .run();
    app.database.db
      .insert(taskEvents)
      .values([
        {
          id: '01JBX7Q3M2V8R4K9T6N0EVT001',
          taskId: task.id,
          type: 'added_to_backlog',
          at: '2026-11-02T14:12:00.000Z',
          day: null,
        },
        {
          id: '01JBX7Q3M2V8R4K9T6N0EVT002',
          taskId: task.id,
          type: 'details_added',
          at: '2026-11-04T01:03:00.000Z',
          day: null,
          data: { parts: ['description', 'list'] },
        },
      ])
      .run();
    const result = await app.request(`/api/tasks/${task.id}`);
    expect(result.status).toBe(200);
    const body: unknown = await result.json();
    expect(taskDetailResponseSchema.parse(body)).toEqual(example);
  } finally {
    app.close();
  }
});
