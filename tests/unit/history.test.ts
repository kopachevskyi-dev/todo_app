import { describe, expect, it } from 'vitest';
import {
  doneGroupIds,
  historySummary,
  missedTaskIds,
  type HistoryEvent,
} from '../../src/domain/history';

const event = (
  taskId: string,
  type: HistoryEvent['type'],
  at: string,
  day: string | null = null,
): HistoryEvent => ({ taskId, type, at, day });

describe('missedTaskIds', () => {
  it('lists a task with missed events for Nov 3 and Nov 5 as not done on both days', () => {
    const events = [
      event('t', 'missed', '2026-11-04T05:00:00.000Z', '2026-11-03'),
      event('t', 'missed', '2026-11-06T05:00:00.000Z', '2026-11-05'),
    ];
    expect(missedTaskIds('2026-11-03', events)).toEqual(['t']);
    expect(missedTaskIds('2026-11-05', events)).toEqual(['t']);
    expect(missedTaskIds('2026-11-04', events)).toEqual([]);
  });
});

describe('historySummary', () => {
  it('words a past day with 4 done and 1 missed as "4 of 5 done · 1 moved to backlog"', () => {
    expect(historySummary({ done: 4, notDone: 1, planned: 0 }, 'past')).toBe(
      '4 of 5 done · 1 moved to backlog',
    );
  });

  it('omits the moved part when nothing was missed', () => {
    expect(historySummary({ done: 3, notDone: 0, planned: 0 }, 'past')).toBe(
      '3 of 3 done',
    );
  });

  it('says "No plan" for a past day with nothing done or missed', () => {
    expect(historySummary({ done: 0, notDone: 0, planned: 0 }, 'past')).toBe(
      'No plan',
    );
  });

  it('says "3 planned" for a future day with 3 open tasks', () => {
    expect(historySummary({ done: 0, notDone: 0, planned: 3 }, 'future')).toBe(
      '3 planned',
    );
  });
});

describe('doneGroupIds', () => {
  it('keeps a task completed on 2026-11-10 and moved to the backlog the same day in the done group of 2026-11-10', () => {
    const events = [
      event('report', 'completed', '2026-11-10T14:00:00.000Z', '2026-11-10'),
      event(
        'report',
        'moved_to_backlog',
        '2026-11-10T15:00:00.000Z',
        '2026-11-10',
      ),
    ];
    expect(doneGroupIds('2026-11-10', events)).toEqual(['report']);
  });
});
