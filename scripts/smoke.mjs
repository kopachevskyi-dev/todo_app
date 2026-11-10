import { startTestServer } from './test-server.mjs';
import { checkServer } from './smoke-probe.mjs';

// An optional entry path makes the startup-failure check reproducible.
const server = await startTestServer({
  entry: process.argv[2] ?? 'dist/server.js',
});
try {
  await checkServer(server.url);
} finally {
  await server.stop();
}
