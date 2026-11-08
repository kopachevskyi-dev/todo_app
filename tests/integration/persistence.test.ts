import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openDatabase } from '../../src/persistence/database';
import { createId } from '../../src/persistence/ids';
import { createRepositories } from '../../src/persistence/repositories';
import {
  lists,
  subtasks,
  taskEvents,
  tasks,
} from '../../src/persistence/schema';

const now = new Date('2026-11-04T19:20:00.000Z');
const instant = now.toISOString();
let directory: string;
let database: ReturnType<typeof openDatabase>;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'todo-persistence-'));
  database = openDatabase(join(directory, 'todo.db'));
});
afterEach(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
});

it('applies migrations only once and preserves changes across restart', () => {
  database.db
    .update(lists)
    .set({ name: 'Renamed' })
    .where(eq(lists.position, 0))
    .run();
  database.db.delete(lists).where(eq(lists.position, 2)).run();
  database.close();
  database = openDatabase(join(directory, 'todo.db'));
  expect(
    createRepositories(database.db)
      .lists.all()
      .map((list) => list.name),
  ).toEqual(['Renamed', 'Work']);
});

it('enforces list names, case-insensitive uniqueness, and the color palette', () => {
  for (const [name, color] of [
    ['PERSONAL', '#E3686A'],
    ['', '#E3686A'],
    [' '.repeat(41), '#E3686A'],
    ['a'.repeat(41), '#E3686A'],
    ['Other', '#000000'],
  ]) {
    expect(() =>
      database.db.run(
        sql`INSERT INTO list (id, name, color, position, created_at) VALUES (${createId(now)}, ${name}, ${color}, 3, ${instant})`,
      ),
    ).toThrow();
  }
});

it('enables foreign keys, nulls a deleted list, and cascades a deleted task', () => {
  const listId = createRepositories(database.db).lists.all()[0]!.id;
  const task = {
    id: createId(now),
    title: 'Read',
    listId,
    placedAt: instant,
    createdAt: instant,
    updatedAt: instant,
  };
  expect(() =>
    database.db
      .insert(tasks)
      .values({ ...task, listId: createId(now) })
      .run(),
  ).toThrow();
  database.db.insert(tasks).values(task).run();
  database.db
    .insert(subtasks)
    .values({
      id: createId(now),
      taskId: task.id,
      title: 'Chapter 1',
      position: 0,
      createdAt: instant,
    })
    .run();
  database.db
    .insert(taskEvents)
    .values({
      id: createId(now),
      taskId: task.id,
      type: 'added_to_backlog',
      at: instant,
      data: { source: 'test' },
    })
    .run();
  expect(database.db.select().from(tasks).get()).toMatchObject({
    description: '',
    day: null,
    completedAt: null,
    missedFrom: null,
  });
  expect(database.db.select().from(subtasks).get()).toMatchObject({
    done: false,
  });
  database.db.delete(lists).where(eq(lists.id, listId)).run();
  expect(database.db.select().from(tasks).get()?.listId).toBeNull();
  database.db.delete(tasks).where(eq(tasks.id, task.id)).run();
  expect(database.db.select().from(subtasks).all()).toEqual([]);
  expect(database.db.select().from(taskEvents).all()).toEqual([]);
});

it('enforces task titles, event types, boolean values, and JSON event data', () => {
  const task = {
    id: createId(now),
    title: 'Read',
    placedAt: instant,
    createdAt: instant,
    updatedAt: instant,
  };
  for (const title of ['', ' untrimmed', 'untrimmed ', 'a'.repeat(201)]) {
    expect(() =>
      database.db
        .insert(tasks)
        .values({ ...task, title })
        .run(),
    ).toThrow();
  }
  database.db.insert(tasks).values(task).run();
  expect(() =>
    database.db.run(
      sql`INSERT INTO subtask (id, task_id, title, done, position, created_at) VALUES (${createId(now)}, ${task.id}, 'Read', 2, 0, ${instant})`,
    ),
  ).toThrow();
  expect(() =>
    database.db.run(
      sql`INSERT INTO task_event (id, task_id, type, at) VALUES (${createId(now)}, ${task.id}, 'unknown', ${instant})`,
    ),
  ).toThrow();
  expect(() =>
    database.db.run(
      sql`INSERT INTO task_event (id, task_id, type, at, data) VALUES (${createId(now)}, ${task.id}, 'planned', ${instant}, 'not json')`,
    ),
  ).toThrow();
});

it('rolls back the repository transaction when its operation fails', () => {
  const repositories = createRepositories(database.db);
  expect(() =>
    repositories.transaction((tx) => {
      tx.delete(lists).run();
      throw new Error('abort');
    }),
  ).toThrow('abort');
  expect(repositories.lists.all()).toHaveLength(3);
});
