import { queryKeys } from './query-keys';
import { invalidateTaskQueries } from './invalidate-task-queries';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTaskRequest,
  List,
  TaskRow as TaskRowData,
} from '../shared/contract';
import { api } from './api';

export const createTaskMutationKey = ['create-task'] as const;
export type CreateTaskContext = {
  request: CreateTaskRequest;
  row: TaskRowData;
};

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
    mutationKey: createTaskMutationKey,
    mutationFn: api.createTask,
    onMutate: (request: CreateTaskRequest): CreateTaskContext => ({
      request,
      row: {
        id: `optimistic-${globalThis.crypto.randomUUID()}`,
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
      },
    }),
    onError: (failure) => {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not add the task. Try again.',
      );
      input.current?.focus();
    },
    onSuccess: ({ task }, request, context) => {
      if (request.target === 'backlog')
        client.setQueryData<{ tasks: TaskRowData[] }>(
          queryKeys.backlogList(request.listId),
          (previous) =>
            previous && {
              tasks: [
                { ...task, list: context.row.list },
                ...previous.tasks.filter((row) => row.id !== task.id),
              ],
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
