import { queryKeys } from './query-keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export function useCompletion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.setCompletion,
    onSuccess: async (_result, { id }) => {
      await Promise.all(
        [
          queryKeys.today,
          queryKeys.history,
          queryKeys.backlog,
          queryKeys.counts,
          queryKeys.search,
          queryKeys.dayLoad,
          queryKeys.taskDetail(id),
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
}
