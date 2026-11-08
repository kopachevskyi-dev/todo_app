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
} as const;

// Placeholders for ticket #16; replaced by the real schemas in the implementation.
export const createTaskRequestSchema = z.never();
export const createTaskResponseSchema = z.custom<{
  task: Record<string, unknown>;
}>(() => false);
