import { expect, it } from 'vitest';
import {
  examples,
  setTodayOrderRequestSchema,
} from '../../src/shared/contract';

it('accepts the today-order request example', () => {
  expect(examples.todayOrderRequest.taskIds).toHaveLength(2);
  expect(new Set(examples.todayOrderRequest.taskIds).size).toBe(2);
  expect(setTodayOrderRequestSchema.parse(examples.todayOrderRequest)).toEqual(
    examples.todayOrderRequest,
  );
});
