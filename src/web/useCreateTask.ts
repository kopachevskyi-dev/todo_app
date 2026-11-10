import { queryKeys } from './query-keys';
import { invalidateTaskQueries } from './invalidate-task-queries';
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
      const backlogKey = queryKeys.backlogList(request.listId);
      const previousBacklog = client.getQueryData<{ tasks: TaskRowData[] }>(
        backlogKey,
      );
      const previousCounts = client.getQueryData<Counts>(queryKeys.counts);
      const id = `optimistic-${globalThis.crypto.randomUUID()}`;
      // An unloaded backlog must stay undefined, including after a failure.
      if (request.target === 'backlog' && previousBacklog) {
        const optimistic: TaskRowData = {
          id,
          title: request.title,
          description: '',
          listId: request.listId ?? null,
          list: list ?? null,
          day: null,
          completedAt: null,
          missedFrom: null,
          subtaskCount: 0,
          subtaskDoneCount: 0,
          createdAt: '1970-01-01T00:00:00.000Z',
          updatedAt: '1970-01-01T00:00:00.000Z',
        };
        client.setQueryData(backlogKey, {
          tasks: [optimistic, ...previousBacklog.tasks],
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
      return { backlogKey, previousBacklog, previousCounts, id };
    },
    onError: (failure, _request, context) => {
      if (context?.previousBacklog)
        client.setQueryData(context.backlogKey, context.previousBacklog);
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
        context.backlogKey,
        (previous) =>
          previous && {
            tasks: previous.tasks.map((row) =>
              row.id === context.id ? { ...task, list: row.list } : row,
            ),
          },
      );
      setTitle((current) => (current.trim() === request.title ? '' : current));
      input.current?.focus();
      onAdded?.();
    },
    onSettled: (result) => {
      void invalidateTaskQueries(client, result ? [result.task.id] : []);
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
