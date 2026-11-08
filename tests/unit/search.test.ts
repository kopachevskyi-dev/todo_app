import { describe, expect, it } from 'vitest';
import {
  locationText,
  matchesQuery,
  parseSearchQuery,
} from '../../src/domain/search';

describe('search matching', () => {
  const byTitle = { title: "Renew driver's license", description: '' };
  const byDescription = {
    title: 'Register the car',
    description: 'Bring the license plate',
  };
  const other = { title: 'Buy milk', description: 'Two litres' };

  it('matches "LICENSE" in a title and in a description, case-insensitively', () => {
    const query = parseSearchQuery('LICENSE');
    expect(query).not.toBeNull();
    expect(matchesQuery(byTitle, query!)).toBe(true);
    expect(matchesQuery(byDescription, query!)).toBe(true);
    expect(matchesQuery(other, query!)).toBe(false);
  });

  it('treats a whitespace-only query as invalid', () => {
    expect(parseSearchQuery('  ')).toBeNull();
  });
});

describe('locationText with today 2026-11-08', () => {
  const today = '2026-11-08';
  it.each([
    ['backlog', { day: null, completedAt: null }, 'Backlog'],
    ['today', { day: '2026-11-08', completedAt: null }, 'Today'],
    ['a planned day', { day: '2026-11-12', completedAt: null }, 'Thu, Nov 12'],
    [
      'done on 2026-11-04',
      { day: '2026-11-04', completedAt: '2026-11-04T15:00:00.000Z' },
      'Done · Wed, Nov 4',
    ],
  ])('%s', (_name, task, expected) => {
    expect(locationText(task, today, 'UTC')).toBe(expected);
  });
});
