import { execFileSync, spawnSync } from 'node:child_process';
const files = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim().split('\n');
const shared = files.some(file => /^(package.*\.json|Dockerfile|compose.*|scripts\/|.*config.*|\.github\/)/.test(file));
const commands = [];
if (shared || files.some(file => file.startsWith('apps/api/'))) commands.push('test:api');
if (shared || files.some(file => /^(apps\/web\/|tests\/e2e\/)/.test(file))) commands.push('test:e2e');
for (const command of commands) {
  const result = spawnSync('npm', ['run', command], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
