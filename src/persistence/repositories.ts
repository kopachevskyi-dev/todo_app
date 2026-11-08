import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  sql,
} from 'drizzle-orm';
import type { AppDatabase } from './database';
import { lists, subtasks, tasks, taskEvents } from './schema';
import { createId } from './ids';
import { applyDetailsEdit, type DetailPart } from '../domain/activity';
import type { CreateTaskRequest, PatchTaskRequest } from '../shared/contract';
import { matchesQuery } from '../domain/search';
import { todayView } from '../domain/today';
import { localDate } from '../domain/time';
import { rolloverTasks } from '../domain/rollover';

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
      rollover: (now: Date, timeZone: string) =>
        db.transaction(
          (tx) => {
            const candidates = tx
              .select({
                id: tasks.id,
                day: tasks.day,
                completedAt: tasks.completedAt,
              })
              .from(tasks)
              .where(
                and(
                  lt(tasks.day, localDate(now, timeZone)),
                  isNull(tasks.completedAt),
                ),
              )
              .all();
            for (const change of rolloverTasks(now, timeZone, candidates)) {
              tx.update(tasks)
                .set({
                  day: change.day,
                  missedFrom: change.missedFrom,
                  placedAt: change.placedAt,
                  updatedAt: now.toISOString(),
                })
                .where(eq(tasks.id, change.id))
                .run();
              tx.insert(taskEvents)
                .values({
                  id: createId(now),
                  taskId: change.id,
                  ...change.event,
                })
                .run();
            }
          },
          { behavior: 'immediate' },
        ),
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
      plan: (id: string, day: string | null, now: Date) =>
        db.transaction((tx) => {
          const at = now.toISOString();
          tx.update(tasks)
            .set({ day, missedFrom: null, placedAt: at, updatedAt: at })
            .where(eq(tasks.id, id))
            .run();
          tx.insert(taskEvents)
            .values({
              id: createId(now),
              taskId: id,
              type: day ? 'planned' : 'moved_to_backlog',
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
      dayLoad: (from: string, to: string) =>
        db
          .select({ day: tasks.day, count: count() })
          .from(tasks)
          .where(between(tasks.day, from, to))
          .groupBy(tasks.day)
          .all(),
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
      today: (day: string, listId?: string) => {
        const rows = db
          .select({
            ...taskFields,
            placedAt: tasks.placedAt,
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
              eq(tasks.day, day),
              listId ? eq(tasks.listId, listId) : undefined,
            ),
          )
          .orderBy(desc(tasks.placedAt), desc(sql`task.rowid`))
          .all();
        return { day, ...todayView(rows, day) };
      },
      setCompletion: (
        id: string,
        completed: boolean,
        now: Date,
        timeZone: string,
      ) =>
        db.transaction((tx) => {
          const at = now.toISOString();
          const day = localDate(now, timeZone);
          const previous = tx
            .select()
            .from(tasks)
            .where(eq(tasks.id, id))
            .get()!;
          tx.update(tasks)
            .set({
              completedAt: completed ? at : null,
              day: completed ? (previous.day ?? day) : day,
              updatedAt: at,
            })
            .where(eq(tasks.id, id))
            .run();
          tx.insert(taskEvents)
            .values({
              id: createId(now),
              taskId: id,
              type: completed ? 'completed' : 'reopened',
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
      search: (query: string) =>
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
          .orderBy(desc(tasks.updatedAt), desc(tasks.id))
          .all()
          .filter((task) => matchesQuery(task, query))
          .slice(0, 50),
      get: (id: string) =>
        db.select(taskFields).from(tasks).where(eq(tasks.id, id)).get(),
      subtasks: (id: string) =>
        db
          .select()
          .from(subtasks)
          .where(eq(subtasks.taskId, id))
          .orderBy(asc(subtasks.position))
          .all(),
      events: (id: string) =>
        db
          .select()
          .from(taskEvents)
          .where(eq(taskEvents.taskId, id))
          .orderBy(asc(taskEvents.at), asc(sql`task_event.rowid`))
          .all(),
      delete: (id: string) => db.delete(tasks).where(eq(tasks.id, id)).run(),
      patch: (id: string, input: PatchTaskRequest, now: Date) =>
        db.transaction((tx) => {
          const previous = tx
            .select()
            .from(tasks)
            .where(eq(tasks.id, id))
            .get()!;
          tx.update(tasks)
            .set({ ...input, updatedAt: now.toISOString() })
            .where(eq(tasks.id, id))
            .run();
          const parts: DetailPart[] = [];
          if (
            input.description?.trim() &&
            input.description !== previous.description
          )
            parts.push('description');
          if (input.listId && input.listId !== previous.listId)
            parts.push('list');
          let latest = tx
            .select()
            .from(taskEvents)
            .where(
              and(
                eq(taskEvents.taskId, id),
                eq(taskEvents.type, 'details_added'),
              ),
            )
            .orderBy(desc(taskEvents.at), desc(sql`task_event.rowid`))
            .get();
          for (const part of parts) {
            const result = applyDetailsEdit(
              latest
                ? {
                    at: latest.at,
                    parts: (latest.data?.parts ?? []) as DetailPart[],
                  }
                : null,
              part,
              now,
            );
            const listName = input.listId
              ? tx.select().from(lists).where(eq(lists.id, input.listId)).get()
                  ?.name
              : latest?.data?.listName;
            const data = {
              parts: result.parts,
              ...(listName ? { listName } : {}),
            };
            if (result.kind === 'update' && latest) {
              tx.update(taskEvents)
                .set({ data })
                .where(eq(taskEvents.id, latest.id))
                .run();
              latest = { ...latest, data };
            } else {
              latest = tx
                .insert(taskEvents)
                .values({
                  id: createId(now),
                  taskId: id,
                  type: 'details_added',
                  at: result.at,
                  data,
                })
                .returning()
                .get();
            }
          }
          return tx
            .select(taskFields)
            .from(tasks)
            .where(eq(tasks.id, id))
            .get()!;
        }),
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
