import type { Context } from 'hono';
import { errorResponseSchema } from '../shared/contract';

export function apiError(
  c: Context,
  code: string,
  message: string,
  status: 400 | 404 | 409 | 500,
) {
  return c.json(
    errorResponseSchema.parse({ error: { code, message } }),
    status,
  );
}
