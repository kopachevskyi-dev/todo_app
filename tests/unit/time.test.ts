import { describe, expect, it } from 'vitest';
import { isTimeZone, localDate } from '../../src/domain/time';

describe('localDate', () => {
  it.each([
    ['2026-11-04T04:30:00.000Z', 'America/New_York', '2026-11-03'],
    ['2026-11-04T05:30:00.000Z', 'America/New_York', '2026-11-04'],
    ['2026-11-03T22:30:00.000Z', 'Europe/Kyiv', '2026-11-04'],
  ])('converts %s in %s to %s', (now, zone, expected) => {
    expect(localDate(new Date(now), zone)).toBe(expected);
  });
});

it('accepts IANA zones and rejects missing, invalid and numeric offsets', () => {
  expect(isTimeZone('UTC')).toBe(true);
  expect(isTimeZone('America/New_York')).toBe(true);
  expect(isTimeZone(undefined)).toBe(false);
  expect(isTimeZone('Mars/Base')).toBe(false);
  expect(isTimeZone('+02:00')).toBe(false);
});
