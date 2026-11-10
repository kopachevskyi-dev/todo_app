import { invalidateTaskQueries } from './invalidate-task-queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export function useCompletion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.setCompletion,
    onSuccess: (_result, { id }) => invalidateTaskQueries(client, [id]),
  });
}
