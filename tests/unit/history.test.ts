import { describe, expect, it } from 'vitest';
import {
  doneTaskIds,
  historySummary,
  missedTaskIds,
  type HistoryEvent,
} from '../../src/domain/history';

const zone = 'America/New_York';
const event = (
  taskId: string,
  type: HistoryEvent['type'],
  at: string,
  day: string | null = null,
): HistoryEvent => ({ taskId, type, at, day });

describe('doneTaskIds', () => {
  const events = [
    // Completed Nov 4 2:20 PM, reopened 3 PM, completed again Nov 5.
    event('reopened', 'completed', '2026-11-04T19:20:00.000Z'),
    event('reopened', 'reopened', '2026-11-04T20:00:00.000Z'),
    event('reopened', 'completed', '2026-11-05T15:00:00.000Z'),
    // Completed Nov 4 and moved to the backlog Nov 8.
    event('moved', 'completed', '2026-11-04T16:00:00.000Z'),
    event('moved', 'moved_to_backlog', '2026-11-08T17:00:00.000Z'),
  ];

  it('counts a task completed, reopened the same day and completed again on Nov 5 as done on Nov 5 only', () => {
    expect(doneTaskIds('2026-11-05', events, zone)).toEqual(['reopened']);
    expect(doneTaskIds('2026-11-04', events, zone)).not.toContain('reopened');
  });

  it('keeps a task completed Nov 4 and moved to the backlog Nov 8 done on Nov 4, in completion order', () => {
    expect(doneTaskIds('2026-11-04', events, zone)).toEqual(['moved']);
  });
});

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
