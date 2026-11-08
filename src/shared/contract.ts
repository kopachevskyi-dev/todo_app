import { z } from 'zod';

export const listColors = [
  '#E3686A',
  '#5FB4C6',
  '#F0C24B',
  '#8E7CC3',
  '#6FBF8A',
] as const;
export const listSchema = z.object({
  id: z.ulid(),
  name: z.string().trim().min(1).max(40),
  color: z.enum(listColors),
  position: z.number().int().nonnegative(),
});
export const listsResponseSchema = z.object({ lists: z.array(listSchema) });
export const healthResponseSchema = z.object({ ok: z.literal(true) });
export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export const clockSchema = z.object({ now: z.iso.datetime() });
export type ListsResponse = z.infer<typeof listsResponseSchema>;

export const examples = {
  createTaskRequest: { title: "Renew driver's license", target: 'backlog' },
  createTaskResponse: {
    task: {
      id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
      title: "Renew driver's license",
      description: '',
      listId: null,
      day: null,
      completedAt: null,
      missedFrom: null,
      subtaskCount: 0,
      subtaskDoneCount: 0,
      createdAt: '2026-11-02T14:12:00.000Z',
      updatedAt: '2026-11-02T14:12:00.000Z',
    },
  },
  lists: {
    lists: [
      {
        id: '01JBX0000000000000000PERSN',
        name: 'Personal',
        color: '#E3686A',
        position: 0,
      },
    ],
  },
  health: { ok: true },
  error: {
    error: {
      code: 'invalid_timezone',
      message: 'A valid X-Timezone header is required.',
    },
  },
  clock: { now: '2026-11-04T19:20:00.000Z' },
  today: {
    day: '2026-11-04',
    open: [
      {
        id: '01JBY1000000000000000000AB',
        title: 'Call the dentist',
        description: '',
        listId: null,
        list: null,
        day: '2026-11-04',
        completedAt: null,
        missedFrom: null,
        subtaskCount: 0,
        subtaskDoneCount: 0,
        createdAt: '2026-11-04T14:00:00.000Z',
        updatedAt: '2026-11-04T14:00:00.000Z',
      },
    ],
    done: [
      {
        id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
        title: "Renew driver's license",
        description: '',
        listId: '01JBX0000000000000000PERSN',
        list: {
          id: '01JBX0000000000000000PERSN',
          name: 'Personal',
          color: '#E3686A',
          position: 0,
        },
        day: '2026-11-04',
        completedAt: '2026-11-04T19:20:00.000Z',
        missedFrom: null,
        subtaskCount: 0,
        subtaskDoneCount: 0,
        createdAt: '2026-11-02T14:12:00.000Z',
        updatedAt: '2026-11-04T19:20:00.000Z',
      },
    ],
    progress: { done: 1, total: 2 },
  },
} as const;

export const taskTitleSchema = z.string().trim().min(1).max(200);
export const createTaskRequestSchema = z.object({
  title: taskTitleSchema,
  target: z.enum(['backlog', 'today']),
});
export const taskSchema = z.object({
  id: z.ulid(),
  title: taskTitleSchema,
  description: z.string(),
  listId: z.ulid().nullable(),
  day: z.iso.date().nullable(),
  completedAt: z.iso.datetime().nullable(),
  missedFrom: z.iso.date().nullable(),
  subtaskCount: z.number().int().nonnegative(),
  subtaskDoneCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const taskRowSchema = taskSchema.extend({ list: listSchema.nullable() });
export const createTaskResponseSchema = z.object({ task: taskSchema });
export const backlogResponseSchema = z.object({
  tasks: z.array(taskRowSchema),
});
export const countsResponseSchema = z.object({
  backlog: z.number().int().nonnegative(),
  todayOpen: z.number().int().nonnegative(),
  todayDone: z.number().int().nonnegative(),
  todayTotal: z.number().int().nonnegative(),
});
export const patchTaskRequestSchema = z
  .object({
    title: taskTitleSchema.optional(),
    description: z.string().optional(),
    listId: z.string().nullable().optional(),
  })
  .strict();
export type PatchTaskRequest = z.infer<typeof patchTaskRequestSchema>;
export const activityItemSchema = z.object({
  type: z.enum([
    'added_to_backlog',
    'added_to_today',
    'details_added',
    'planned',
    'completed',
    'reopened',
    'moved_to_backlog',
    'missed',
  ]),
  at: z.iso.datetime(),
  day: z.iso.date().nullable(),
  text: z.string(),
});
export const subtaskSchema = z.object({
  id: z.ulid(),
  taskId: z.ulid(),
  title: z.string(),
  done: z.boolean(),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
});
export const taskDetailResponseSchema = z.object({
  task: taskSchema,
  subtasks: z.array(subtaskSchema),
  activity: z.array(activityItemSchema),
});
export type Task = z.infer<typeof taskSchema>;
export type TaskRow = z.infer<typeof taskRowSchema>;
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type Counts = z.infer<typeof countsResponseSchema>;

export const searchResponseSchema = z.object({
  results: z
    .array(
      taskRowSchema.extend({
        location: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('backlog'), day: z.null() }),
          z.object({ kind: z.literal('today'), day: z.iso.date() }),
          z.object({ kind: z.literal('planned'), day: z.iso.date() }),
          z.object({ kind: z.literal('done'), day: z.iso.date() }),
        ]),
      }),
    )
    .max(50),
});

export const todayResponseSchema = z.object({
  day: z.iso.date(),
  open: z.array(taskRowSchema),
  done: z.array(taskRowSchema),
  progress: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});
export type TodayResponse = z.infer<typeof todayResponseSchema>;
