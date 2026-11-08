import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export function useCompletion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.setCompletion,
    onSuccess: async (_result, { id }) => {
      await Promise.all(
        [
          ['today'],
          ['history'],
          ['backlog'],
          ['counts'],
          ['search'],
          ['day-load'],
          ['task', id],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
}

export function completionTime(at: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(at));
}
