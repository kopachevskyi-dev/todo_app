import { expect, it } from 'vitest';
import { progressWidget, weekWidget } from '../../src/web/progress';

it('with 3 done and 5 open tasks the Progress widget reads badge "3 of 8", big number 38 with unit "% of today" (round(3 / 8 * 100)), bar fill 37.5%', () => {
  expect(progressWidget({ done: 3, total: 8 })).toEqual({
    badge: '3 of 8',
    percent: 38,
    unit: '% of today',
    fill: 37.5,
  });
});

it('with 3 done, 1 missed and 4 planned tasks across the week the Week widget reads badge "3 of 8", big number 38 with unit "% done" (round(done / (done + missed + planned) * 100)), bar fill 37.5%', () => {
  expect(
    weekWidget([
      { done: 3, notDone: 1, planned: 0 },
      { done: 0, notDone: 0, planned: 4 },
    ]),
  ).toEqual({ badge: '3 of 8', percent: 38, unit: '% done', fill: 37.5 });
});
