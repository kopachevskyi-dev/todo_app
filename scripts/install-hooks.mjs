import { spawnSync } from 'node:child_process';
// Worktrees may have read-only Git metadata; enable manually after merging there.
const repo = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
if (repo.status === 0) {
  const current = spawnSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8' });
  if (current.stdout.trim() !== '.githooks') {
    spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  }
}
