import { z } from 'zod';

export const listPalette = [
  { name: 'Red', hex: '#E3686A' },
  { name: 'Teal', hex: '#5FB4C6' },
  { name: 'Yellow', hex: '#F0C24B' },
  { name: 'Purple', hex: '#8E7CC3' },
  { name: 'Green', hex: '#6FBF8A' },
] as const;
export const listColors = listPalette.map(({ hex }) => hex) as [
  (typeof listPalette)[number]['hex'],
  ...(typeof listPalette)[number]['hex'][],
];
export const listSchema = z.object({
  id: z.ulid(),
  name: z.string().trim().min(1).max(40),
  color: z.enum(listColors),
  position: z.number().int().nonnegative(),
});
export const createListRequestSchema = listSchema
  .pick({ name: true, color: true })
  .partial({ color: true })
  .strict();
export const patchListRequestSchema = createListRequestSchema.partial();
export const listResponseSchema = z.object({ list: listSchema });
export type List = z.infer<typeof listSchema>;
export type CreateListRequest = z.infer<typeof createListRequestSchema>;
export type PatchListRequest = z.infer<typeof patchListRequestSchema>;
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
  clock: { now: '2026-11-10T14:00:00.000Z' },
  today: {
    day: '2026-11-10',
    open: [
      {
        id: '01JBY1000000000000000000AB',
        title: 'Call the dentist',
        description: '',
        listId: null,
        list: null,
        day: '2026-11-10',
        completedAt: null,
        missedFrom: null,
        subtaskCount: 0,
        subtaskDoneCount: 0,
        createdAt: '2026-11-10T14:00:00.000Z',
        updatedAt: '2026-11-10T14:00:00.000Z',
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
        day: '2026-11-10',
        completedAt: '2026-11-10T14:00:00.000Z',
        missedFrom: null,
        subtaskCount: 0,
        subtaskDoneCount: 0,
        createdAt: '2026-11-02T14:12:00.000Z',
        updatedAt: '2026-11-10T14:00:00.000Z',
      },
    ],
    progress: { done: 1, total: 2 },
  },
  planTaskRequest: {
    day: '2026-11-11',
  },
  dayInPastError: {
    error: {
      code: 'day_in_past',
      message: 'Choose today or a later day.',
    },
  },
  notInBacklogError: {
    error: {
      code: 'not_in_backlog',
      message: 'One or more tasks are not in the backlog.',
      taskIds: ['01JBY2000000000000000000CD'],
    },
  },
  dayLoad: {
    days: {
      '2026-11-10': 2,
      '2026-11-11': 0,
      '2026-11-12': 3,
    },
  },
  history: {
    weekStart: '2026-11-02',
    today: '2026-11-08',
    days: [
      {
        day: '2026-11-02',
        done: 3,
        notDone: 0,
        planned: 0,
        groups: {
          done: [
            {
              id: '01JBZ000000000000000000001',
              title: 'Mon done 1',
              description: '',
              listId: null,
              day: '2026-11-02',
              completedAt: '2026-11-02T19:20:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-02T15:00:00.000Z',
              updatedAt: '2026-11-02T19:20:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000002',
              title: 'Mon done 2',
              description: '',
              listId: null,
              day: '2026-11-02',
              completedAt: '2026-11-02T19:21:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-02T15:00:00.000Z',
              updatedAt: '2026-11-02T19:21:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000003',
              title: 'Mon done 3',
              description: '',
              listId: null,
              day: '2026-11-02',
              completedAt: '2026-11-02T19:22:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-02T15:00:00.000Z',
              updatedAt: '2026-11-02T19:22:00.000Z',
              list: null,
            },
          ],
          notDone: [],
          planned: [],
        },
      },
      {
        day: '2026-11-03',
        done: 4,
        notDone: 1,
        planned: 0,
        groups: {
          done: [
            {
              id: '01JBZ000000000000000000004',
              title: 'Tue done 1',
              description: '',
              listId: null,
              day: '2026-11-03',
              completedAt: '2026-11-03T19:20:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-03T15:00:00.000Z',
              updatedAt: '2026-11-03T19:20:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000005',
              title: 'Tue done 2',
              description: '',
              listId: null,
              day: '2026-11-03',
              completedAt: '2026-11-03T19:21:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-03T15:00:00.000Z',
              updatedAt: '2026-11-03T19:21:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000006',
              title: 'Tue done 3',
              description: '',
              listId: null,
              day: '2026-11-03',
              completedAt: '2026-11-03T19:22:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-03T15:00:00.000Z',
              updatedAt: '2026-11-03T19:22:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000007',
              title: 'Tue done 4',
              description: '',
              listId: null,
              day: '2026-11-03',
              completedAt: '2026-11-03T19:23:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-03T15:00:00.000Z',
              updatedAt: '2026-11-03T19:23:00.000Z',
              list: null,
            },
          ],
          notDone: [
            {
              id: '01JBZ000000000000000000008',
              title: 'Tue missed 1',
              description: '',
              listId: null,
              day: null,
              completedAt: null,
              missedFrom: '2026-11-03',
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-03T15:00:00.000Z',
              updatedAt: '2026-11-04T15:00:00.000Z',
              list: null,
              movedTo: 'backlog',
            },
          ],
          planned: [],
        },
      },
      {
        day: '2026-11-04',
        done: 4,
        notDone: 1,
        planned: 0,
        groups: {
          done: [
            {
              id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
              title: "Renew driver's license",
              description: '',
              listId: '01JBX0000000000000000PERSN',
              day: '2026-11-04',
              completedAt: '2026-11-04T19:20:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-04T15:00:00.000Z',
              updatedAt: '2026-11-08T17:00:00.000Z',
              list: {
                id: '01JBX0000000000000000PERSN',
                name: 'Personal',
                color: '#E3686A',
                position: 0,
              },
            },
            {
              id: '01JBZ000000000000000000009',
              title: 'Wed done 2',
              description: '',
              listId: null,
              day: '2026-11-04',
              completedAt: '2026-11-04T19:21:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-04T15:00:00.000Z',
              updatedAt: '2026-11-04T19:21:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000010',
              title: 'Wed done 3',
              description: '',
              listId: null,
              day: '2026-11-04',
              completedAt: '2026-11-04T19:22:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-04T15:00:00.000Z',
              updatedAt: '2026-11-04T19:22:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000011',
              title: 'Wed done 4',
              description: '',
              listId: null,
              day: '2026-11-04',
              completedAt: '2026-11-04T19:23:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-04T15:00:00.000Z',
              updatedAt: '2026-11-04T19:23:00.000Z',
              list: null,
            },
          ],
          notDone: [
            {
              id: '01JBZ000000000000000000012',
              title: 'Call the dentist',
              description: '',
              listId: null,
              day: null,
              completedAt: null,
              missedFrom: '2026-11-04',
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-04T15:00:00.000Z',
              updatedAt: '2026-11-05T15:00:00.000Z',
              list: null,
              movedTo: 'backlog',
            },
          ],
          planned: [],
        },
      },
      {
        day: '2026-11-05',
        done: 3,
        notDone: 1,
        planned: 0,
        groups: {
          done: [
            {
              id: '01JBZ000000000000000000013',
              title: 'Thu done 1',
              description: '',
              listId: null,
              day: '2026-11-05',
              completedAt: '2026-11-05T19:20:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-05T15:00:00.000Z',
              updatedAt: '2026-11-05T19:20:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000014',
              title: 'Thu done 2',
              description: '',
              listId: null,
              day: '2026-11-05',
              completedAt: '2026-11-05T19:21:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-05T15:00:00.000Z',
              updatedAt: '2026-11-05T19:21:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000015',
              title: 'Thu done 3',
              description: '',
              listId: null,
              day: '2026-11-05',
              completedAt: '2026-11-05T19:22:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-05T15:00:00.000Z',
              updatedAt: '2026-11-05T19:22:00.000Z',
              list: null,
            },
          ],
          notDone: [
            {
              id: '01JBZ000000000000000000016',
              title: 'Thu missed 1',
              description: '',
              listId: null,
              day: null,
              completedAt: null,
              missedFrom: '2026-11-05',
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-05T15:00:00.000Z',
              updatedAt: '2026-11-06T15:00:00.000Z',
              list: null,
              movedTo: 'backlog',
            },
          ],
          planned: [],
        },
      },
      {
        day: '2026-11-06',
        done: 2,
        notDone: 0,
        planned: 0,
        groups: {
          done: [
            {
              id: '01JBZ000000000000000000017',
              title: 'Fri done 1',
              description: '',
              listId: null,
              day: '2026-11-06',
              completedAt: '2026-11-06T19:20:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-06T15:00:00.000Z',
              updatedAt: '2026-11-06T19:20:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000018',
              title: 'Fri done 2',
              description: '',
              listId: null,
              day: '2026-11-06',
              completedAt: '2026-11-06T19:21:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-06T15:00:00.000Z',
              updatedAt: '2026-11-06T19:21:00.000Z',
              list: null,
            },
          ],
          notDone: [],
          planned: [],
        },
      },
      {
        day: '2026-11-07',
        done: 0,
        notDone: 0,
        planned: 0,
        groups: {
          done: [],
          notDone: [],
          planned: [],
        },
      },
      {
        day: '2026-11-08',
        done: 1,
        notDone: 0,
        planned: 2,
        groups: {
          done: [
            {
              id: '01JBZ000000000000000000019',
              title: 'Sun done 1',
              description: '',
              listId: null,
              day: '2026-11-08',
              completedAt: '2026-11-08T15:05:00.000Z',
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-08T15:00:00.000Z',
              updatedAt: '2026-11-08T15:05:00.000Z',
              list: null,
            },
          ],
          notDone: [],
          planned: [
            {
              id: '01JBZ000000000000000000020',
              title: 'Sun open 2',
              description: '',
              listId: null,
              day: '2026-11-08',
              completedAt: null,
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-08T15:00:00.000Z',
              updatedAt: '2026-11-08T15:00:00.000Z',
              list: null,
            },
            {
              id: '01JBZ000000000000000000021',
              title: 'Sun open 1',
              description: '',
              listId: null,
              day: '2026-11-08',
              completedAt: null,
              missedFrom: null,
              subtaskCount: 0,
              subtaskDoneCount: 0,
              createdAt: '2026-11-08T15:00:00.000Z',
              updatedAt: '2026-11-08T15:00:00.000Z',
              list: null,
            },
          ],
        },
      },
    ],
  },
  taskDetail: {
    task: {
      id: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
      title: "Renew driver's license",
      description: 'Bring identification and the renewal form.',
      listId: '01JBX0000000000000000PERSN',
      day: '2026-11-10',
      completedAt: '2026-11-10T14:00:00.000Z',
      missedFrom: null,
      subtaskCount: 2,
      subtaskDoneCount: 1,
      createdAt: '2026-11-02T14:12:00.000Z',
      updatedAt: '2026-11-10T14:00:00.000Z',
    },
    subtasks: [
      {
        id: '01JBX000000000000000000001',
        taskId: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
        title: 'Gather identification',
        done: true,
        position: 0,
        createdAt: '2026-11-02T14:20:00.000Z',
      },
      {
        id: '01JBX000000000000000000002',
        taskId: '01JBX7Q3M2V8R4K9T6N0P1S5WZ',
        title: 'Fill out renewal form',
        done: false,
        position: 1,
        createdAt: '2026-11-02T14:21:00.000Z',
      },
    ],
    activity: [
      {
        type: 'added_to_backlog',
        at: '2026-11-02T14:12:00.000Z',
        day: null,
        text: 'added to backlog',
      },
      {
        type: 'details_added',
        at: '2026-11-02T14:15:00.000Z',
        day: null,
        text: 'description and list added',
      },
      {
        type: 'planned',
        at: '2026-11-09T14:00:00.000Z',
        day: '2026-11-10',
        text: 'planned for Nov 10',
      },
      {
        type: 'completed',
        at: '2026-11-10T14:00:00.000Z',
        day: '2026-11-10',
        text: 'completed',
      },
    ],
  },
} as const;

export const taskTitleSchema = z.string().trim().min(1).max(200);
export const createTaskRequestSchema = z.object({
  title: taskTitleSchema,
  target: z.enum(['backlog', 'today']),
  listId: z.ulid().optional(),
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
export const activityTypes = [
  'added_to_backlog',
  'added_to_today',
  'details_added',
  'planned',
  'completed',
  'reopened',
  'moved_to_backlog',
  'missed',
] as const;
export const activityTypeSchema = z.enum(activityTypes);
export type ActivityType = z.infer<typeof activityTypeSchema>;
export const activityItemSchema = z.object({
  type: activityTypeSchema,
  at: z.iso.datetime(),
  day: z.iso.date().nullable(),
  text: z.string(),
});
/** Subtask responses include the stored position and UTC creation instant. */
export const subtaskSchema = z.object({
  id: z.ulid(),
  taskId: z.ulid(),
  title: z.string(),
  done: z.boolean(),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
});
export const createSubtaskRequestSchema = z
  .object({ title: taskTitleSchema })
  .strict();
export const patchSubtaskRequestSchema = z
  .object({
    title: taskTitleSchema.optional(),
    done: z.boolean().optional(),
  })
  .strict();
export const subtaskResponseSchema = z.object({ subtask: subtaskSchema });
export type Subtask = z.infer<typeof subtaskSchema>;
export type PatchSubtaskRequest = z.infer<typeof patchSubtaskRequestSchema>;

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

export const planTaskRequestSchema = z
  .object({ day: z.iso.date().nullable() })
  .strict();
/** Duplicate taskIds are rejected with 400 invalid_request. */
export const planTodayRequestSchema = z
  .object({
    taskIds: z
      .array(z.ulid())
      .min(1)
      .max(100)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Task ids must be unique.',
      ),
  })
  .strict();
/** Tasks follow the order of taskIds in the request. */
export const planTodayResponseSchema = z.object({ tasks: z.array(taskSchema) });
export const dayLoadResponseSchema = z.object({
  days: z.record(z.iso.date(), z.number().int().nonnegative()),
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

const historyTaskSchema = taskRowSchema.partial().extend({
  id: z.ulid(),
  title: taskTitleSchema,
  listId: z.ulid().nullable(),
});
export const historyResponseSchema = z.object({
  weekStart: z.iso.date(),
  today: z.iso.date(),
  days: z.array(
    z.object({
      day: z.iso.date(),
      done: z.number().int().nonnegative(),
      notDone: z.number().int().nonnegative(),
      planned: z.number().int().nonnegative(),
      groups: z.object({
        done: z.array(
          historyTaskSchema.extend({ completedAt: z.iso.datetime() }),
        ),
        notDone: z.array(
          historyTaskSchema.extend({ movedTo: z.literal('backlog') }),
        ),
        planned: z.array(historyTaskSchema),
      }),
    }),
  ),
});
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
