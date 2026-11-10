import assert from 'node:assert/strict';

export async function checkServer(url) {
  const health = await fetch(`${url}/api/health`, {
    headers: { 'X-Timezone': 'UTC' },
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  const page = await fetch(`${url}/today`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<h1>Today<\/h1>/);
  console.log('Smoke passed: health and Today page served by the real server.');
}
