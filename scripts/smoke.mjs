import assert from 'node:assert/strict';
import { startTestServer } from './test-server.mjs';

// An optional entry path makes the startup-failure check reproducible.
const server = await startTestServer({
  entry: process.argv[2] ?? 'dist/server.js',
});
try {
  const health = await fetch(`${server.url}/api/health`, {
    headers: { 'X-Timezone': 'America/New_York' },
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  const page = await fetch(server.url, { signal: AbortSignal.timeout(5000) });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<h1>Today<\/h1>/);
  console.log('Smoke passed: health and Today page served by the real server.');
} finally {
  await server.stop();
}
