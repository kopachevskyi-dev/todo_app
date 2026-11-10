import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// A payload literal is any date, instant, ULID or list color written in a test.
const payloadLiteral = /\d{4}-\d{2}-\d{2}|\b01[0-9A-Z]{24}\b|#[0-9A-F]{6}\b/;

it('no contract test declares a payload literal of its own; payloads come from examples', () => {
  const offenders = readdirSync(__dirname)
    .filter(
      (file) => file.endsWith('.test.ts') && file !== 'examples-only.test.ts',
    )
    .filter((file) =>
      payloadLiteral.test(readFileSync(join(__dirname, file), 'utf8')),
    );
  expect(offenders).toEqual([]);
});
