import { spawn, spawnSync } from 'node:child_process';
const args = ['compose', '-f', 'compose.test.yaml', '-p', process.env.E2E_PROJECT ?? 'todo-app-test'];
const keepAlive = setInterval(() => {}, 1000);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(keepAlive);
  const down = spawnSync('docker', [...args, 'down', '-v'], { stdio: 'inherit' });
  process.exit(code || down.status || 0);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
const up = spawn('docker', [...args, 'up', '--build', '-d', '--wait'], { stdio: 'inherit' });
up.on('error', error => { console.error(error); stop(1); });
up.on('exit', code => { if (code !== 0 && !stopping) stop(code || 1); });
