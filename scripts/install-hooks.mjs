import { spawnSync } from 'node:child_process';

// A source archive or a production-only install has no Git metadata.
const inside = spawnSync('git', ['rev-parse', '--git-dir'], {
  encoding: 'utf8',
});
if (inside.status === 0) {
  const configured = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    encoding: 'utf8',
  });
  if (configured.stdout.trim() !== '.githooks') {
    const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
      stdio: 'inherit',
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
