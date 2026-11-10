import { queryKeys } from './query-keys';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Counts,
  CreateTaskRequest,
  List,
  TaskRow as TaskRowData,
} from '../shared/contract';
import { api } from './api';
export function useCreateTask({
  target,
  list,
  onAdded,
}: {
  target: 'backlog' | 'today';
  list?: List;
  onAdded?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.createTask,
    onMutate: async (request: CreateTaskRequest) => {
      await Promise.all([
        client.cancelQueries({ queryKey: queryKeys.backlog }),
        client.cancelQueries({ queryKey: queryKeys.counts }),
      ]);
      const previousBacklog = client.getQueryData<{ tasks: TaskRowData[] }>(
        queryKeys.backlogList(list?.id),
      );
      const previousCounts = client.getQueryData<Counts>(queryKeys.counts);
      const id = `optimistic-${globalThis.crypto.randomUUID()}`;
      if (request.target === 'backlog') {
        const optimistic: TaskRowData = {
          id,
          title: request.title,
          description: '',
          listId: list?.id ?? null,
          list: list ?? null,
          day: null,
          completedAt: null,
          missedFrom: null,
          subtaskCount: 0,
          subtaskDoneCount: 0,
          createdAt: '1970-01-01T00:00:00.000Z',
          updatedAt: '1970-01-01T00:00:00.000Z',
        };
        client.setQueryData(queryKeys.backlogList(list?.id), {
          tasks: [optimistic, ...(previousBacklog?.tasks ?? [])],
        });
      }
      if (previousCounts)
        client.setQueryData<Counts>(queryKeys.counts, {
          ...previousCounts,
          backlog:
            previousCounts.backlog + (request.target === 'backlog' ? 1 : 0),
          todayOpen:
            previousCounts.todayOpen + (request.target === 'today' ? 1 : 0),
          todayTotal:
            previousCounts.todayTotal + (request.target === 'today' ? 1 : 0),
        });
      return { previousBacklog, previousCounts, id };
    },
    onError: (failure, _request, context) => {
      if (context?.previousBacklog)
        client.setQueryData(
          queryKeys.backlogList(list?.id),
          context.previousBacklog,
        );
      else client.setQueryData(queryKeys.backlogList(list?.id), { tasks: [] });
      if (context?.previousCounts)
        client.setQueryData(queryKeys.counts, context.previousCounts);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not add the task. Try again.',
      );
      input.current?.focus();
    },
    onSuccess: ({ task }, request, context) => {
      client.setQueryData<{ tasks: TaskRowData[] }>(
        queryKeys.backlogList(list?.id),
        (previous) =>
          previous && {
            tasks: previous.tasks.map((row) =>
              row.id === context.id ? { ...task, list: list ?? null } : row,
            ),
          },
      );
      setTitle((current) => (current.trim() === request.title ? '' : current));
      input.current?.focus();
      onAdded?.();
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.today });
      void client.invalidateQueries({ queryKey: queryKeys.backlog });
      void client.invalidateQueries({ queryKey: queryKeys.counts });
    },
  });
  const submit = () => {
    if (mutation.isPending || !title.trim()) return;
    if (title.trim().length > 200) {
      setError('Title must be between 1 and 200 characters.');
      return;
    }
    setError(undefined);
    mutation.mutate({
      title: title.trim(),
      target,
      ...(list ? { listId: list.id } : {}),
    });
  };
  return { title, setTitle, error, setError, input, mutation, submit };
}
