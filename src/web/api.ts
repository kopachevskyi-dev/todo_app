import type { z } from 'zod';
import {
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
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(errorResponseSchema.parse(body).error.message);
  return schema.parse(body);
}

export const api = {
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
