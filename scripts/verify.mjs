import { spawnSync } from 'node:child_process';

const steps = [
  'lint',
  'typecheck',
  'test:unit',
  'test:integration',
  'test:contract',
  // Container images already contain the shared Docker build stage's output.
  ...(process.env.APP_PREBUILT === 'true' ? [] : ['build']),
  'test:e2e:built',
  process.env.SMOKE_IMAGE ? 'smoke:image' : 'smoke:built',
];
for (const step of steps) {
  const result = spawnSync('pnpm', [step], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
