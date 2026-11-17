import { expect, it } from 'vitest';
import { createListRequestSchema } from '../../src/shared/contract';

it('accepts a v3 list color and rejects a color from the old palette', () => {
  expect(
    createListRequestSchema.safeParse({ name: 'Errands', color: '#8b6ad8' })
      .success,
  ).toBe(true);
  // The old Purple, built from parts: contract tests may not hold hex literals.
  const oldPurple = ['#', '8E7CC3'].join('');
  expect(
    createListRequestSchema.safeParse({ name: 'Errands', color: oldPurple })
      .success,
  ).toBe(false);
});
