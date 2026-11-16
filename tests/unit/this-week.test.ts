import { expect, it } from 'vitest';
import { thisWeekWidget } from '../../src/web/progress';

it('on Tue, Nov 10 with upcoming tasks on Nov 11, 13, 15, 16 and 20 the This week widget reads badge "3 planned" (days up to Sunday Nov 15), big number 5 (all upcoming) with unit "ahead", bar fill 60% (3 / 5 * 100)', () => {
  const tasks = [
    '2026-11-11',
    '2026-11-13',
    '2026-11-15',
    '2026-11-16',
    '2026-11-20',
  ].map((day) => ({ day }));
  expect(thisWeekWidget(tasks, '2026-11-10')).toEqual({
    badge: '3 planned',
    number: 5,
    unit: 'ahead',
    fill: 60,
  });
});
