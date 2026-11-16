import { expect, it } from 'vitest';
import { progressWidget } from '../../src/web/progress';

it('with 3 done and 5 open tasks the Progress widget reads badge "3 of 8", big number 38 with unit "% of today" (round(3 / 8 * 100)), bar fill 37.5%', () => {
  expect(progressWidget({ done: 3, total: 8 })).toEqual({
    badge: '3 of 8',
    percent: 38,
    unit: '% of today',
    fill: 37.5,
  });
});
