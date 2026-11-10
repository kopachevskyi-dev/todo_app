import type { z } from 'zod';
import type { taskDetailResponseSchema } from '../shared/contract';
export type TaskDetailData = z.infer<typeof taskDetailResponseSchema>;
