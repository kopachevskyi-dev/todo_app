import { expect, it } from 'vitest';
import { taskMeta } from '../../src/domain/task-meta';

it('formats the row meta from the list name and the subtask count', () => {
  expect(taskMeta('Personal', 3)).toBe('Personal · 3 subtasks');
  expect(taskMeta(null, 1)).toBe('1 subtask');
  expect(taskMeta(null, 0)).toBe('');
});
