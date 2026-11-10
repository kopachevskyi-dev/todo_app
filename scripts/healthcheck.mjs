import assert from 'node:assert/strict';

const response = await fetch(
  `http://127.0.0.1:${process.env.PORT ?? 3000}/api/health`,
  {
    headers: { 'X-Timezone': 'UTC' },
    signal: AbortSignal.timeout(4000),
  },
);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { ok: true });
