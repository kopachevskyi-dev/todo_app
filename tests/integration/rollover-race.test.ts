import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { eq, sql } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { openDatabase } from '../../src/persistence/database';
import { taskEvents, tasks } from '../../src/persistence/schema';

const run = promisify(execFile);
const at = '2026-11-02T14:12:00.000Z';

it('gives each unfinished task exactly one missed event when two connections run rollover for the same day at the same time', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'todo-race-'));
  const path = join(directory, 'todo.db');
  const database = openDatabase(path);
  try {
    const ids = Array.from(
      { length: 400 },
      (_, i) => `01JBX7Q3M2V8R4K9T6N0${String(i).padStart(6, '0')}`,
    );
    database.db
      .insert(tasks)
      .values(
        ids.map((id) => ({
          id,
          title: `Task ${id.slice(-6)}`,
          day: '2026-11-02',
          placedAt: at,
          createdAt: at,
          updatedAt: at,
        })),
      )
      .run();

    const startAt = String(Date.now() + 3000);
    const worker = () =>
      run(resolve('node_modules/.bin/tsx'), [
        'tests/helpers/rollover-worker.ts',
        path,
        '2026-11-05T05:00:05.000Z',
        'America/New_York',
        startAt,
      ]);
    await Promise.all([worker(), worker()]);

    const counts = database.db
      .select({ taskId: taskEvents.taskId, n: sql<number>`count(*)` })
      .from(taskEvents)
      .where(eq(taskEvents.type, 'missed'))
      .groupBy(taskEvents.taskId)
      .all();
    expect(counts).toHaveLength(400);
    expect(counts.filter((row) => row.n !== 1)).toEqual([]);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
