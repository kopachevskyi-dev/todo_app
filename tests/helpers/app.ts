import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/persistence/database';
import { createApp } from '../../src/api/app';
import type { Clock } from '../../src/api/clock';

export const fixedClock: Clock = {
  now: () => new Date('2026-11-04T19:20:00.000Z'),
};

export function testApp(
  options: { testClock?: boolean; logError?: (error: Error) => void } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'todo-integration-'));
  const database = openDatabase(join(directory, 'todo.db'));
  const app = createApp({ db: database.db, clock: fixedClock, ...options });
  return {
    database,
    rawRequest: (path: string, init: RequestInit = {}) =>
      app.request(path, init),
    request: (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has('X-Timezone'))
        headers.set('X-Timezone', 'America/New_York');
      return app.request(path, { ...init, headers });
    },
    close: () => {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
