import { describe, expect, it } from 'vitest';
import { applyDetailsEdit } from '../../src/domain/activity';

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
