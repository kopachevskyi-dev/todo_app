import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { listColors, activityTypes } from '../shared/contract';

export const lists = sqliteTable(
  'list',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color', { enum: listColors }).notNull(),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('list_name_unique').on(sql`${table.name} COLLATE NOCASE`),
    check(
      'list_name_length',
      sql`length(${table.name}) BETWEEN 1 AND 40 AND length(trim(${table.name})) > 0`,
    ),
    check(
      'list_color',
      sql`${table.color} IN ('#E3686A', '#5FB4C6', '#F0C24B', '#8E7CC3', '#6FBF8A', '#6A93D4', '#E8975A', '#D985A8')`,
    ),
  ],
);

export const tasks = sqliteTable(
  'task',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    listId: text('list_id').references(() => lists.id, {
      onDelete: 'set null',
    }),
    day: text('day'),
    completedAt: text('completed_at'),
    missedFrom: text('missed_from'),
    placedAt: text('placed_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check(
      'task_title',
      sql`length(${table.title}) BETWEEN 1 AND 200 AND ${table.title} = trim(${table.title})`,
    ),
    index('task_list_id').on(table.listId),
  ],
);

export const subtasks = sqliteTable(
  'subtask',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    check('subtask_done', sql`${table.done} IN (0, 1)`),
    index('subtask_task_id').on(table.taskId),
  ],
);

export const eventTypes = activityTypes;
export const taskEvents = sqliteTable(
  'task_event',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    type: text('type', { enum: eventTypes }).notNull(),
    at: text('at').notNull(),
    day: text('day'),
    data: text('data', { mode: 'json' }).$type<Record<
      string,
      unknown
    > | null>(),
  },
  (table) => [
    check(
      'task_event_type',
      sql`${table.type} IN ('added_to_backlog', 'added_to_today', 'details_added', 'planned', 'completed', 'reopened', 'moved_to_backlog', 'missed')`,
    ),
    check(
      'task_event_data',
      sql`${table.data} IS NULL OR json_valid(${table.data})`,
    ),
    index('task_event_task_id').on(table.taskId),
  ],
);
