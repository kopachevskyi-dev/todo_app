import { describe, expect, it } from 'vitest';
import { matchesQuery, parseSearchQuery } from '../../src/domain/search';

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
