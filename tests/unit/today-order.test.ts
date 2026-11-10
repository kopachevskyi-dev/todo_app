import { expect, it } from 'vitest';
import { moveTodayTask } from '../../src/web/today-order';

it('moves twice from the latest cache even before the visible props rerender', () => {
  const visible = ['A', 'B', 'C'].map((id) => ({ id }));
  const first = moveTodayTask(visible, visible, 'C', -1)!;
  expect(first.map((task) => task.id)).toEqual(['A', 'C', 'B']);
  const second = moveTodayTask(first, visible, 'C', -1)!;
  expect(second.map((task) => task.id)).toEqual(['C', 'A', 'B']);
});

it('keeps hidden tasks in their slots during rapid filtered moves', () => {
  const open = ['A', 'hidden', 'B', 'C'].map((id) => ({ id }));
  const visible = open.filter((task) => task.id !== 'hidden');
  const first = moveTodayTask(open, visible, 'C', -1)!;
  const second = moveTodayTask(first, visible, 'C', -1)!;
  expect(second.map((task) => task.id)).toEqual(['C', 'hidden', 'A', 'B']);
  expect(open.map((task) => task.id)).toEqual(['A', 'hidden', 'B', 'C']);
  expect(moveTodayTask(second, visible, 'C', -1)).toBeUndefined();
});
