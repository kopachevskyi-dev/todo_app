import { describe, expect, it } from 'vitest';
import {
  dayPickerItems,
  loadLabel,
  planButtonLabel,
} from '../../src/domain/day-picker';

const ZONE = 'America/New_York';
const labels = (now: string) =>
  dayPickerItems(new Date(now), ZONE).map((item) => item.label);

describe('day picker items', () => {
  it.each([
    [
      'Tue Nov 3, 8:05 PM',
      '2026-11-04T01:05:00.000Z',
      ['Today, Tue 3', 'Tomorrow, Wed 4', 'Weekend, Sat 7'],
    ],
    [
      'Thu Nov 5',
      '2026-11-05T17:00:00.000Z',
      ['Today, Thu 5', 'Tomorrow, Fri 6', 'Weekend, Sat 7'],
    ],
    [
      'Fri Nov 6 (tomorrow is Sat 7)',
      '2026-11-06T17:00:00.000Z',
      ['Today, Fri 6', 'Tomorrow, Sat 7', 'Weekend, Sat 14'],
    ],
    [
      'Sat Nov 7',
      '2026-11-07T17:00:00.000Z',
      ['Today, Sat 7', 'Tomorrow, Sun 8', 'Weekend, Sat 14'],
    ],
  ])('on %s', (_name, now, expected) => {
    expect(labels(now)).toEqual(expected);
  });
});

describe('load and primary labels', () => {
  it.each([
    [0, 'Free'],
    [1, '1 task'],
    [4, '4 tasks'],
  ])('load %i is "%s"', (count, expected) => {
    expect(loadLabel(count)).toBe(expected);
  });

  it.each([
    ['2026-11-04', '2026-11-03', 'Plan for Wed, Nov 4'],
    ['2026-11-03', '2026-11-03', 'Plan for today'],
    [null, '2026-11-03', 'Choose a day'],
  ])('chosen %s with today %s reads "%s"', (chosen, today, expected) => {
    expect(planButtonLabel(chosen, today)).toBe(expected);
  });
});
