import { describe, expect, it } from 'vitest';
import { activityLines, type ActivityEvent } from '../../src/domain/activity';

// Stored kind → v3 line(s), from design-language.md ("Activity": Added to Backlog,
// Planned for {day}, Returned to Backlog, Completed) and the App mockup's event list.
//   added_to_backlog    → added      "Added to Backlog"
//   added_to_today      → added      "Added to Backlog" + planned "Planned for {day}" (v3 shows both)
//   planned             → planned    "Planned for {day}"
//   completed           → completed  "Completed"
//   moved_to_backlog    → returned   "Returned to Backlog"
//   missed              → returned   "Returned to Backlog"
//   details_added       → no line (v3 does not show it)
//   reopened            → no line, and it cancels the completed line before it
const at = '2026-11-04T01:03:00.000Z';

describe('activityLines: the four v3 kinds', () => {
  it.each([
    [
      'added_to_backlog',
      [{ type: 'added_to_backlog', at, day: null }],
      [{ type: 'added', at, day: null, text: 'Added to Backlog' }],
    ],
    [
      'added_to_today',
      [{ type: 'added_to_today', at, day: '2026-11-04' }],
      [
        { type: 'added', at, day: '2026-11-04', text: 'Added to Backlog' },
        { type: 'planned', at, day: '2026-11-04', text: 'Planned for Nov 4' },
      ],
    ],
    [
      'planned',
      [{ type: 'planned', at, day: '2026-11-17' }],
      [{ type: 'planned', at, day: '2026-11-17', text: 'Planned for Nov 17' }],
    ],
    [
      'completed',
      [{ type: 'completed', at, day: '2026-11-04' }],
      [{ type: 'completed', at, day: '2026-11-04', text: 'Completed' }],
    ],
    [
      'moved_to_backlog',
      [{ type: 'moved_to_backlog', at, day: null }],
      [{ type: 'returned', at, day: null, text: 'Returned to Backlog' }],
    ],
    [
      'missed',
      [{ type: 'missed', at, day: '2026-11-09' }],
      [
        {
          type: 'returned',
          at,
          day: '2026-11-09',
          text: 'Returned to Backlog',
        },
      ],
    ],
    [
      'details_added',
      [
        {
          type: 'details_added',
          at,
          day: null,
          data: { parts: ['description', 'list'] },
        },
      ],
      [],
    ],
    ['reopened', [{ type: 'reopened', at, day: '2026-11-04' }], []],
  ] as const)('%s', (_kind, events, expected) => {
    expect(activityLines(events as unknown as ActivityEvent[])).toEqual(
      expected,
    );
  });

  it('shows 3 lines for added, details merged into one event, planned, completed (was 4)', () => {
    const lines = activityLines([
      { type: 'added_to_backlog', at: '2026-11-02T14:12:00.000Z', day: null },
      {
        type: 'details_added',
        at: '2026-11-02T14:15:00.000Z',
        day: null,
        data: { parts: ['description', 'subtasks', 'list'] },
      },
      { type: 'planned', at: '2026-11-09T14:00:00.000Z', day: '2026-11-10' },
      { type: 'completed', at: '2026-11-10T14:00:00.000Z', day: '2026-11-10' },
    ] as ActivityEvent[]);
    expect(lines.map((line) => line.text)).toEqual([
      'Added to Backlog',
      'Planned for Nov 10',
      'Completed',
    ]);
  });

  it('shows no Completed line for a completed task that was reopened', () => {
    const lines = activityLines([
      { type: 'added_to_backlog', at: '2026-11-02T14:12:00.000Z', day: null },
      { type: 'planned', at: '2026-11-09T14:00:00.000Z', day: '2026-11-10' },
      { type: 'completed', at: '2026-11-10T14:00:00.000Z', day: '2026-11-10' },
      { type: 'reopened', at: '2026-11-10T15:00:00.000Z', day: '2026-11-10' },
    ] as ActivityEvent[]);
    expect(lines.map((line) => line.text)).toEqual([
      'Added to Backlog',
      'Planned for Nov 10',
    ]);
  });
});
