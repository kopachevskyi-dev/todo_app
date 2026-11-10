import { expect, it } from 'vitest';
import {
  examples,
  setTodayOrderRequestSchema,
} from '../../src/shared/contract';

it('accepts the today-order request example', () => {
  expect(examples.todayOrderRequest).toEqual({
    taskIds: ['01JBY3000000000000000000EF', '01JBY1000000000000000000AB'],
  });
  expect(setTodayOrderRequestSchema.parse(examples.todayOrderRequest)).toEqual(
    examples.todayOrderRequest,
  );
});
