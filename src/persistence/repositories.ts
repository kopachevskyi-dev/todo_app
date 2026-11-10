import { historyView } from '../domain/history';
import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  inArray,
  lt,
  sql,
} from 'drizzle-orm';
import type { AppDatabase } from './database';
import { lists, subtasks, tasks, taskEvents } from './schema';
import { createId } from './ids';
import { applyDetailsEdit, type DetailPart } from '../domain/activity';
import { listColors } from '../shared/contract';
import type {
  CreateListRequest,
  PatchListRequest,
  CreateTaskRequest,
  PatchTaskRequest,
  PatchSubtaskRequest,
} from '../shared/contract';
import { matchesQuery } from '../domain/search';
import { todayView } from '../domain/today';
import { localDate } from '../domain/time';
import { rolloverTasks } from '../domain/rollover';

export function createRepositories(db: AppDatabase) {
  const transaction = <T>(
    work: (tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0]) => T,
    config?: Parameters<AppDatabase['transaction']>[1],
  ) => db.transaction(work, config);
  const listFields = {
    id: lists.id,
    name: lists.name,
    color: lists.color,
    position: lists.position,
  };
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
    subtaskCount: sql<number>`${db
      .select({ value: count() })
      .from(subtasks)
      .where(eq(subtasks.taskId, tasks.id))}`,
    subtaskDoneCount: sql<number>`${db
      .select({ value: count() })
      .from(subtasks)
      .where(and(eq(subtasks.taskId, tasks.id), eq(subtasks.done, true)))}`,
  };
  const total = (where: ReturnType<typeof and>) =>
    db.select({ value: count() }).from(tasks).where(where).get()!.value;
  const recordDetailsEdit = (
    tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    taskId: string,
    part: DetailPart,
    now: Date,
    listName?: string,
  ) => {
    const latest = tx
      .select()
      .from(taskEvents)
      .where(
        and(
          eq(taskEvents.taskId, taskId),
          eq(taskEvents.type, 'details_added'),
        ),
      )
      .orderBy(desc(taskEvents.at), desc(sql`task_event.rowid`))
      .get();
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
    const name = listName ?? latest?.data?.listName;
    const data = { parts: result.parts, ...(name ? { listName: name } : {}) };
    if (result.kind === 'update' && latest) {
      tx.update(taskEvents)
        .set({ data })
        .where(eq(taskEvents.id, latest.id))
        .run();
    } else {
      tx.insert(taskEvents)
        .values({
          id: createId(now),
          taskId,
          type: 'details_added',
          at: result.at,
          data,
        })
        .run();
    }
  };
  return {
    tasks: {
      rollover: (now: Date, timeZone: string) =>
        transaction(
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
        transaction((tx) => {
          const id = createId(now);
          const at = now.toISOString();
          const day =
            input.target === 'today' ? localDate(now, timeZone) : null;
          tx.insert(tasks)
            .values({
              id,
              title: input.title,
              listId: input.listId,
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
        transaction((tx) => {
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
      planToday: (ids: string[], day: string, now: Date) =>
        transaction(
          (tx) => {
            const selected = tx
              .select({
                id: tasks.id,
                day: tasks.day,
                completedAt: tasks.completedAt,
              })
              .from(tasks)
              .where(inArray(tasks.id, ids))
              .all();
            const eligible = new Set(
              selected
                .filter(
                  (task) => task.day === null && task.completedAt === null,
                )
                .map((task) => task.id),
            );
            const taskIds = ids.filter((id) => !eligible.has(id));
            if (taskIds.length) return { taskIds };

            const at = now.toISOString();
            for (const id of ids) {
              tx.update(tasks)
                .set({ day, missedFrom: null, placedAt: at, updatedAt: at })
                .where(eq(tasks.id, id))
                .run();
              tx.insert(taskEvents)
                .values({
                  id: createId(now),
                  taskId: id,
                  type: 'planned',
                  at,
                  day,
                })
                .run();
            }
            const planned = tx
              .select(taskFields)
              .from(tasks)
              .where(inArray(tasks.id, ids))
              .all();
            const byId = new Map(planned.map((task) => [task.id, task]));
            return { tasks: ids.map((id) => byId.get(id)!) };
          },
          { behavior: 'immediate' },
        ),
      moveToBacklog: (id: string, now: Date) =>
        transaction((tx) => {
          const at = now.toISOString();
          tx.update(tasks)
            .set({
              completedAt: null,
              day: null,
              missedFrom: null,
              placedAt: at,
              updatedAt: at,
            })
            .where(eq(tasks.id, id))
            .run();
          tx.insert(taskEvents)
            .values({
              id: createId(now),
              taskId: id,
              type: 'moved_to_backlog',
              at,
            })
            .run();
          return tx
            .select(taskFields)
            .from(tasks)
            .where(eq(tasks.id, id))
            .get()!;
        }),
      history: (
        weekStart: string,
        now: Date,
        zone: string,
        listId?: string,
      ) => {
        const rows = db
          .select({
            ...taskFields,
            list: listFields,
          })
          .from(tasks)
          .leftJoin(lists, eq(tasks.listId, lists.id))
          .where(listId ? eq(tasks.listId, listId) : undefined)
          .orderBy(desc(tasks.placedAt), desc(sql`task.rowid`))
          .all();
        const events = db
          .select()
          .from(taskEvents)
          .orderBy(asc(taskEvents.at), asc(sql`task_event.rowid`))
          .all();
        return historyView(rows, events, weekStart, now, zone);
      },
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
            list: listFields,
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
            list: listFields,
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
        transaction((tx) => {
          const at = now.toISOString();
          const day = localDate(now, timeZone);
          tx.update(tasks)
            .set({
              completedAt: completed ? at : null,
              day,
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
            list: listFields,
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
        transaction((tx) => {
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
          for (const part of parts) {
            const listName = input.listId
              ? tx.select().from(lists).where(eq(lists.id, input.listId)).get()
                  ?.name
              : undefined;
            recordDetailsEdit(tx, id, part, now, listName);
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
    subtasks: {
      get: (id: string) =>
        db.select().from(subtasks).where(eq(subtasks.id, id)).get(),
      create: (taskId: string, title: string, now: Date) =>
        transaction((tx) => {
          const last = tx
            .select({ position: subtasks.position })
            .from(subtasks)
            .where(eq(subtasks.taskId, taskId))
            .orderBy(desc(subtasks.position))
            .get();
          const subtask = tx
            .insert(subtasks)
            .values({
              id: createId(now),
              taskId,
              title,
              done: false,
              position: (last?.position ?? -1) + 1,
              createdAt: now.toISOString(),
            })
            .returning()
            .get();
          tx.update(tasks)
            .set({ updatedAt: now.toISOString() })
            .where(eq(tasks.id, taskId))
            .run();
          recordDetailsEdit(tx, taskId, 'subtasks', now);
          return subtask;
        }),
      patch: (id: string, input: PatchSubtaskRequest, now: Date) =>
        transaction((tx) => {
          const subtask = tx
            .update(subtasks)
            .set(input)
            .where(eq(subtasks.id, id))
            .returning()
            .get()!;
          tx.update(tasks)
            .set({ updatedAt: now.toISOString() })
            .where(eq(tasks.id, subtask.taskId))
            .run();
          return subtask;
        }),
      delete: (id: string, now: Date) =>
        transaction((tx) => {
          const subtask = tx
            .delete(subtasks)
            .where(eq(subtasks.id, id))
            .returning()
            .get()!;
          tx.update(tasks)
            .set({ updatedAt: now.toISOString() })
            .where(eq(tasks.id, subtask.taskId))
            .run();
        }),
    },
    lists: {
      get: (id: string) =>
        db.select().from(lists).where(eq(lists.id, id)).get(),
      named: (name: string) =>
        db
          .select()
          .from(lists)
          .where(sql`${lists.name} = ${name} COLLATE NOCASE`)
          .get(),
      create: (input: CreateListRequest, now: Date) =>
        transaction((tx) => {
          const existing = tx
            .select()
            .from(lists)
            .orderBy(asc(lists.position))
            .all();
          return tx
            .insert(lists)
            .values({
              id: createId(now),
              name: input.name,
              color:
                input.color ??
                listColors.find(
                  (color) => !existing.some((list) => list.color === color),
                ) ??
                '#8E7CC3',
              position: (existing.at(-1)?.position ?? -1) + 1,
              createdAt: now.toISOString(),
            })
            .returning()
            .get();
        }),
      patch: (id: string, input: PatchListRequest) =>
        Object.keys(input).length
          ? db
              .update(lists)
              .set(input)
              .where(eq(lists.id, id))
              .returning()
              .get()!
          : db.select().from(lists).where(eq(lists.id, id)).get()!,
      delete: (id: string) => db.delete(lists).where(eq(lists.id, id)).run(),
      all: () =>
        db.select(listFields).from(lists).orderBy(asc(lists.position)).all(),
    },
    transaction,
  };
}
