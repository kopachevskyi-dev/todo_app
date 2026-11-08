import { describe, expect, it } from 'vitest';
import {
  applyDetailsEdit,
  formatActivityLine,
} from '../../src/domain/activity';

describe('formatActivityLine', () => {
  it('formats a planned event in the request zone', () => {
    expect(
      formatActivityLine(
        { type: 'planned', at: '2026-11-04T01:05:00.000Z', day: '2026-11-04' },
        'America/New_York',
      ),
    ).toBe('Nov 3, 8:05 PM — planned for Nov 4');
  });
});

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
    expect(
      formatActivityLine(
        {
          type: 'details_added',
          at: result.at,
          day: null,
          data: { parts: result.parts },
        },
        'America/New_York',
      ),
    ).toBe('Nov 3, 8:03 PM — description and subtasks added');
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
