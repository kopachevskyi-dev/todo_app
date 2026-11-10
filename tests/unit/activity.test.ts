import { describe, expect, it } from 'vitest';
import {
  activityText,
  applyDetailsEdit,
  type ActivityEvent,
} from '../../src/domain/activity';

describe('details_added merging', () => {
  const first = {
    at: '2026-11-04T01:03:00.000Z',
    parts: ['description' as const],
  };

  it('merges a subtasks edit 7 minutes later into the first event, keeping its time', () => {
    const result = applyDetailsEdit(
      first,
      'subtasks',
      new Date('2026-11-04T01:10:00.000Z'),
    );
    expect(result).toEqual({
      kind: 'update',
      at: '2026-11-04T01:03:00.000Z',
      parts: ['description', 'subtasks'],
    });
  });

  it('creates a new event 17 minutes later', () => {
    expect(
      applyDetailsEdit(first, 'subtasks', new Date('2026-11-04T01:20:00.000Z')),
    ).toEqual({
      kind: 'create',
      at: '2026-11-04T01:20:00.000Z',
      parts: ['subtasks'],
    });
  });
});

describe('activityText wording (documented in the design language)', () => {
  const at = '2026-11-04T01:03:00.000Z';
  it.each([
    [{ type: 'added_to_backlog', at }, 'added to backlog'],
    [{ type: 'added_to_today', at }, 'added to today'],
    [{ type: 'planned', at, day: '2026-11-04' }, 'planned for Nov 4'],
    [{ type: 'completed', at }, 'completed'],
    [{ type: 'reopened', at }, 'reopened'],
    [{ type: 'moved_to_backlog', at }, 'moved to backlog'],
    [
      { type: 'missed', at, day: '2026-11-09' },
      'missed Nov 9, moved to backlog',
    ],
    [
      {
        type: 'details_added',
        at,
        data: { parts: ['list'], listName: 'Personal' },
      },
      'list set to Personal',
    ],
    [
      {
        type: 'details_added',
        at,
        data: { parts: ['description', 'subtasks', 'list'] },
      },
      'description, subtasks and list added',
    ],
  ] as const)('%j reads "%s"', (event, text) => {
    expect(activityText(event as ActivityEvent)).toBe(text);
  });
});
