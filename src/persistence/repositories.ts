import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from './database';
import { lists, subtasks, tasks, taskEvents } from './schema';
import { createId } from './ids';
import type { CreateTaskRequest } from '../shared/contract';
import { localDate } from '../domain/time';

export function createRepositories(db: AppDatabase) {
  const taskFields = {
    id: tasks.id,
    title: tasks.title,
    description: tasks.description,
    listId: tasks.listId,
    day: tasks.day,
    completedAt: tasks.completedAt,
    missedFrom: tasks.missedFrom,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
    subtaskCount: sql<number>`(SELECT count(*) FROM ${subtasks} WHERE ${subtasks.taskId} = ${tasks.id})`,
    subtaskDoneCount: sql<number>`(SELECT count(*) FROM ${subtasks} WHERE ${subtasks.taskId} = ${tasks.id} AND ${subtasks.done} = 1)`,
  };
  const total = (where: ReturnType<typeof and>) =>
    db.select({ value: count() }).from(tasks).where(where).get()!.value;
  return {
    tasks: {
      create: (input: CreateTaskRequest, now: Date, timeZone: string) =>
        db.transaction((tx) => {
          const id = createId(now);
          const at = now.toISOString();
          const day =
            input.target === 'today' ? localDate(now, timeZone) : null;
          tx.insert(tasks)
            .values({
              id,
              title: input.title,
              day,
              placedAt: at,
              createdAt: at,
              updatedAt: at,
            })
            .run();
          tx.insert(taskEvents)
            .values({
              id: createId(now),
              taskId: id,
              type:
                input.target === 'today'
                  ? 'added_to_today'
                  : 'added_to_backlog',
              at,
              day,
            })
            .run();
          return tx
            .select(taskFields)
            .from(tasks)
            .where(eq(tasks.id, id))
            .get()!;
        }),
      backlog: (listId?: string) =>
        db
          .select({
            ...taskFields,
            list: {
              id: lists.id,
              name: lists.name,
              color: lists.color,
              position: lists.position,
            },
          })
          .from(tasks)
          .leftJoin(lists, eq(tasks.listId, lists.id))
          .where(
            and(
              isNull(tasks.day),
              isNull(tasks.completedAt),
              listId ? eq(tasks.listId, listId) : undefined,
            ),
          )
          .orderBy(desc(tasks.placedAt), desc(sql`task.rowid`))
          .all(),
      get: (id: string) =>
        db.select(taskFields).from(tasks).where(eq(tasks.id, id)).get(),
      counts: (today: string) => ({
        backlog: total(and(isNull(tasks.day), isNull(tasks.completedAt))),
        todayOpen: total(and(eq(tasks.day, today), isNull(tasks.completedAt))),
        todayDone: total(
          and(eq(tasks.day, today), isNotNull(tasks.completedAt)),
        ),
        todayTotal: total(eq(tasks.day, today)),
      }),
    },
    lists: {
      all: () =>
        db
          .select({
            id: lists.id,
            name: lists.name,
            color: lists.color,
            position: lists.position,
          })
          .from(lists)
          .orderBy(asc(lists.position))
          .all(),
    },
    transaction: <T>(
      work: (tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0]) => T,
    ) => db.transaction(work),
  };
}
