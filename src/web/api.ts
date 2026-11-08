import type { z } from 'zod';
import {
  errorResponseSchema,
  healthResponseSchema,
  listsResponseSchema,
} from '../shared/contract';

async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone },
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(errorResponseSchema.parse(body).error.message);
  return schema.parse(body);
}

export const api = {
  lists: () => request('/lists', listsResponseSchema),
  health: () => request('/health', healthResponseSchema),
};
