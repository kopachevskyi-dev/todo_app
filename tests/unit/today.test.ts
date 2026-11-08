import { expect, it } from 'vitest';
import { todayView } from '../../src/domain/today';

const task = (
  title: string,
  day: string,
  completedAt: string | null,
  placedAt: string,
) => ({ title, day, completedAt, placedAt });

it('selects 3 open and 2 done tasks for Nov 4, done ordered 10:00 then 2:20 PM, progress 2 of 5, ignoring Nov 5', () => {
  const view = todayView(
    [
      task(
        'Done late',
        '2026-11-04',
        '2026-11-04T19:20:00.000Z',
        '2026-11-04T13:00:00.000Z',
      ),
      task('Open oldest', '2026-11-04', null, '2026-11-04T13:01:00.000Z'),
      task(
        'Done early',
        '2026-11-04',
        '2026-11-04T15:00:00.000Z',
        '2026-11-04T13:02:00.000Z',
      ),
      task('Open newest', '2026-11-04', null, '2026-11-04T13:04:00.000Z'),
      task('Open middle', '2026-11-04', null, '2026-11-04T13:03:00.000Z'),
      task('Tomorrow', '2026-11-05', null, '2026-11-04T13:05:00.000Z'),
    ],
    '2026-11-04',
  );
  expect(view.open.map((t) => t.title)).toEqual([
    'Open newest',
    'Open middle',
    'Open oldest',
  ]);
  expect(view.done.map((t) => t.title)).toEqual(['Done early', 'Done late']);
  expect(view.progress).toEqual({ done: 2, total: 5 });
});
