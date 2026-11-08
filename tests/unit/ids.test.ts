import { expect, it } from 'vitest';
import { decodeTime } from 'ulid';
import { z } from 'zod';
import { createId } from '../../src/persistence/ids';

it.each(['2026-11-04T19:20:00.000Z', '1970-01-01T00:00:00.000Z'])(
  'generates a ULID from the injected instant %s',
  (instant) => {
    const now = new Date(instant);
    const id = createId(now);
    expect(z.ulid().safeParse(id).success).toBe(true);
    expect(decodeTime(id)).toBe(now.getTime());
    expect(createId(now)).not.toBe(id);
  },
);

it('rejects invalid instants instead of silently reading the clock', () => {
  expect(() => createId(new Date('invalid'))).toThrow();
});
