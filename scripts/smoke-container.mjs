import { execFileSync, spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const image = process.env.SMOKE_IMAGE;
if (!image) throw new Error('SMOKE_IMAGE must name the built runtime image.');

function docker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

// Let Docker choose both the container name and the host port. tmpfs makes the
// database fresh and disposable, without touching a project's named app volume.
const container = docker([
  'create',
  '--publish',
  '127.0.0.1::3000',
  '--tmpfs',
  '/app/data:rw,uid=1000,gid=1000',
  image,
  'node',
  process.argv[2] ?? 'dist/server.js',
]);
function cleanup() {
  docker(['rm', '--force', '--volumes', container]);
}
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    try {
      cleanup();
    } finally {
      process.exit(1);
    }
  });
}

try {
  docker(['start', container]);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    const [state] = JSON.parse(docker(['inspect', container]));
    if (!state.State.Running)
      throw new Error(
        `Runtime exited before readiness (${state.State.ExitCode}).`,
      );
    if (state.State.Health?.Status === 'healthy') {
      ready = true;
      break;
    }
    await setTimeout(250);
  }
  if (!ready) throw new Error('Runtime health check timed out.');
  console.log(
    `Runtime published at ${docker(['port', container, '3000/tcp'])}`,
  );
  // Probe inside the runtime so the same command works from the host and from
  // a verify container using the daemon socket, including on Docker Desktop.
  console.log(
    docker([
      'exec',
      container,
      'node',
      '--input-type=module',
      '-e',
      "import { checkServer } from './scripts/smoke-probe.mjs'; await checkServer('http://127.0.0.1:3000');",
    ]),
  );
} catch (error) {
  spawnSync('docker', ['logs', container], {
    stdio: 'inherit',
    timeout: 30000,
  });
  throw error;
} finally {
  cleanup();
}
