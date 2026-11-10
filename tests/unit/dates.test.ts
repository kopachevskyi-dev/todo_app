import { expect, it } from 'vitest';
import { formatShortDate } from '../../src/web/dates';

it('formats the local date 2026-11-11 in America/New_York as a short date', () => {
  expect(formatShortDate('2026-11-11', 'America/New_York')).toBe('Wed, Nov 11');
});
