import { describe, expect, it } from 'vitest';
import { rolloverTasks } from '../../src/domain/rollover';
import { rowMetaText } from '../../src/domain/row-meta';

const task = (
  id: string,
  day: string | null,
  completedAt: string | null = null,
) => ({
  id,
  day,
  completedAt,
});

describe('rolloverTasks', () => {
  it('moves an open Nov 4 task to the backlog at 00:00:30 Nov 5 in New York and leaves done and current tasks alone', () => {
    const changes = rolloverTasks(
      new Date('2026-11-05T05:00:30.000Z'),
      'America/New_York',
      [
        task('open', '2026-11-04'),
        task('done', '2026-11-04', '2026-11-04T15:00:00.000Z'),
        task('current', '2026-11-05'),
      ],
    );
    expect(changes).toEqual([
      {
        id: 'open',
        day: null,
        missedFrom: '2026-11-04',
        placedAt: '2026-11-05T05:00:00.000Z',
        event: {
          type: 'missed',
          day: '2026-11-04',
          at: '2026-11-05T05:00:00.000Z',
        },
      },
    ]);
  });

  it('uses the start of a 25-hour DST day: Nov 1 00:30 in New York rolls an Oct 31 task', () => {
    const changes = rolloverTasks(
      new Date('2026-11-01T05:30:00.000Z'),
      'America/New_York',
      [task('t', '2026-10-31')],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      missedFrom: '2026-10-31',
      placedAt: '2026-11-01T04:00:00.000Z',
    });
  });

  it('rolls nothing at 23:59 Nov 4 in Kyiv and rolls the Nov 4 task at 00:00', () => {
    const candidates = [task('t', '2026-11-04')];
    expect(
      rolloverTasks(
        new Date('2026-11-04T21:59:00.000Z'),
        'Europe/Kyiv',
        candidates,
      ),
    ).toEqual([]);
    const changes = rolloverTasks(
      new Date('2026-11-04T22:00:00.000Z'),
      'Europe/Kyiv',
      candidates,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      id: 't',
      missedFrom: '2026-11-04',
      placedAt: '2026-11-04T22:00:00.000Z',
    });
  });
});

describe('rowMetaText', () => {
  it('joins list, missed day and subtask count', () => {
    expect(
      rowMetaText({
        listName: 'Personal',
        missedFrom: '2026-11-04',
        subtaskCount: 3,
      }),
    ).toBe('Personal · from Wed, Nov 4 · 3 subtasks');
  });
});
