import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['unit', 'integration', 'contract'].map((name) => ({
      test: {
        name,
        include: [`tests/${name}/**/*.test.ts`],
        environment: 'node',
      },
    })),
  },
});
