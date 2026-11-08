import { z } from 'zod';
import {
  historyResponseSchema,
  createSubtaskRequestSchema,
  patchSubtaskRequestSchema,
  subtaskResponseSchema,
  type PatchSubtaskRequest,
  clockSchema,
  dayLoadResponseSchema,
  planTaskRequestSchema,
  planTodayRequestSchema,
  planTodayResponseSchema,
  todayResponseSchema,
  patchTaskRequestSchema,
  type PatchTaskRequest,
  searchResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  listsResponseSchema,
  backlogResponseSchema,
  countsResponseSchema,
  createTaskRequestSchema,
  createTaskResponseSchema,
  taskDetailResponseSchema,
  type CreateTaskRequest,
} from '../shared/contract';

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  const body: unknown =
    response.status === 204 ? undefined : await response.json();
  if (!response.ok)
    throw new Error(errorResponseSchema.parse(body).error.message);
  return schema.parse(body);
}

export const api = {
  history: (weekStart: string, listId?: string) =>
    request(
      `/views/history?${new URLSearchParams({ weekStart, ...(listId ? { listId } : {}) })}`,
      historyResponseSchema,
    ),
  moveToBacklog: (id: string) =>
    request(
      `/tasks/${encodeURIComponent(id)}/move-to-backlog`,
      createTaskResponseSchema,
      { method: 'POST' },
    ),
  createSubtask: (taskId: string, title: string) =>
    request(
      `/tasks/${encodeURIComponent(taskId)}/subtasks`,
      subtaskResponseSchema,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createSubtaskRequestSchema.parse({ title })),
      },
    ),
  patchSubtask: (id: string, input: PatchSubtaskRequest) =>
    request(`/subtasks/${encodeURIComponent(id)}`, subtaskResponseSchema, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchSubtaskRequestSchema.parse(input)),
    }),
  deleteSubtask: (id: string) =>
    request(`/subtasks/${encodeURIComponent(id)}`, z.undefined(), {
      method: 'DELETE',
    }),

  clock: () => request('/clock', clockSchema),
  dayLoad: (from: string, to: string) =>
    request(`/day-load?from=${from}&to=${to}`, dayLoadResponseSchema),
  planTask: (id: string, day: string | null) =>
    request(`/tasks/${encodeURIComponent(id)}/plan`, createTaskResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planTaskRequestSchema.parse({ day })),
    }),
  planToday: (taskIds: string[]) =>
    request('/tasks/plan-today', planTodayResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planTodayRequestSchema.parse({ taskIds })),
    }),
  today: (listId?: string) =>
    request(
      `/views/today${listId ? `?listId=${encodeURIComponent(listId)}` : ''}`,
      todayResponseSchema,
    ),
  setCompletion: ({ id, completed }: { id: string; completed: boolean }) =>
    request(
      `/tasks/${encodeURIComponent(id)}/${completed ? 'complete' : 'reopen'}`,
      createTaskResponseSchema,
      { method: 'POST' },
    ),
  patchTask: (id: string, input: PatchTaskRequest) =>
    request(`/tasks/${encodeURIComponent(id)}`, createTaskResponseSchema, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchTaskRequestSchema.parse(input)),
    }),
  deleteTask: (id: string) =>
    request(`/tasks/${encodeURIComponent(id)}`, z.undefined(), {
      method: 'DELETE',
    }),
  search: (query: string) =>
    request(`/search?q=${encodeURIComponent(query)}`, searchResponseSchema),
  lists: () => request('/lists', listsResponseSchema),
  health: () => request('/health', healthResponseSchema),
  backlog: (listId?: string) =>
    request(
      `/views/backlog${listId ? `?listId=${encodeURIComponent(listId)}` : ''}`,
      backlogResponseSchema,
    ),
  counts: () => request('/counts', countsResponseSchema),
  task: (id: string) =>
    request(`/tasks/${encodeURIComponent(id)}`, taskDetailResponseSchema),
  createTask: (input: CreateTaskRequest) =>
    request('/tasks', createTaskResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createTaskRequestSchema.parse(input)),
    }),
};
