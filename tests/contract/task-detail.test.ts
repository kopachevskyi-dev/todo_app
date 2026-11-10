import { expect, it } from 'vitest';
import { examples, taskDetailResponseSchema } from '../../src/shared/contract';
import { subtasks, taskEvents, tasks } from '../../src/persistence/schema';
import { testApp } from '../helpers/app';

it('parses the detail example, with two subtasks (one done) and planned and completed events', () => {
  const example = taskDetailResponseSchema.parse(examples.taskDetail);
  expect(example.subtasks).toHaveLength(2);
  expect(example.subtasks.filter((s) => s.done)).toHaveLength(1);
  const types = example.activity.map((item) => item.type);
  expect(types).toContain('planned');
  expect(types).toContain('completed');
});

it('returns the detail example for the fixture task', async () => {
  const app = testApp();
  try {
    const example = taskDetailResponseSchema.parse(examples.taskDetail);
    const { task } = example;
    app.database.db
      .insert(tasks)
      .values({
        id: task.id,
        title: task.title,
        description: task.description,
        listId: task.listId,
        day: task.day,
        completedAt: task.completedAt,
        missedFrom: task.missedFrom,
        placedAt: task.createdAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })
      .run();
    app.database.db.insert(subtasks).values(example.subtasks).run();
    app.database.db
      .insert(taskEvents)
      .values(
        example.activity.map((item, i) => ({
          id: `01JBX7Q3M2V8R4K9T6N0EVT${String(i + 1).padStart(3, '0')}`,
          taskId: task.id,
          type: item.type,
          at: item.at,
          day: item.day,
          // Only `details_added` text depends on stored data.
          data:
            item.type === 'details_added'
              ? { parts: ['description', 'list'] }
              : null,
        })),
      )
      .run();
    const result = await app.request(`/api/tasks/${task.id}`);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(examples.taskDetail);
  } finally {
    app.close();
  }
});
