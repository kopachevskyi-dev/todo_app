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
import { useNavigate } from '@tanstack/react-router';
import { useNotification } from './notification-context';
import { formatDay } from '../domain/day-picker';
import { historyWeekStart } from '../domain/history';

export type CaptureDraft = {
  title: string;
  listId?: string | null;
  day?: string | null;
};

export const createTaskMutationKey = ['create-task'] as const;
export type CreateTaskContext = {
  request: CreateTaskRequest;
  row: TaskRowData;
};

export function useCreateTask({
  target,
  list,
  onAdded,
  day,
  today,
  filteredIds,
  draft,
  onDraftChange,
}: {
  target: 'backlog' | 'today';
  list?: List;
  onAdded?: () => void;
  day?: string | null;
  today?: string;
  filteredIds: string[];
  draft: CaptureDraft;
  onDraftChange: (value: CaptureDraft) => void;
}) {
  const currentDraft = draft;
  const setDraft = onDraftChange;
  const title = currentDraft.title;
  const setTitle = (title: string) =>
    setDraft(
      title
        ? { ...currentDraft, title, listId: list?.id ?? null, day }
        : { title: '' },
    );
  const navigate = useNavigate();
  const notify = useNotification();
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
        day: request.day ?? null,
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
      if (task.day === null)
        client.setQueryData<{ tasks: TaskRowData[] }>(
          queryKeys.backlogList(),
          (previous) =>
            previous && {
              tasks: [
                { ...task, list: context.row.list },
                ...previous.tasks.filter((row) => row.id !== task.id),
              ],
            },
        );
      if (title.trim() === request.title) setDraft({ title: '' });
      const outsideFilter =
        filteredIds.length > 0 &&
        (!task.listId || !filteredIds.includes(task.listId));
      const outsideDay =
        target === 'today' ? task.day !== today : task.day !== null;
      if (outsideFilter || outsideDay) {
        const destination = outsideDay
          ? task.day
            ? task.day === today
              ? 'Today'
              : formatDay(task.day)
            : 'Backlog'
          : (context.row.list?.name ?? 'No list');
        notify({
          message: `Added to ${destination}${outsideFilter ? ' — not shown in this filter' : ''}`,
          actions: [
            {
              label: 'Open',
              onClick: () => {
                if (!task.day)
                  void navigate({ to: '/backlog', search: { task: task.id } });
                else if (task.day === today)
                  void navigate({ to: '/today', search: { task: task.id } });
                else
                  void navigate({
                    to: '/history',
                    search: {
                      week: historyWeekStart(task.day),
                      day: task.day,
                      task: task.id,
                    },
                  });
              },
            },
          ],
        });
      }
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
      target: day === undefined ? target : day === null ? 'backlog' : 'today',
      ...(day !== undefined ? { day } : {}),
      ...(list ? { listId: list.id } : {}),
    });
  };
  return { title, setTitle, error, setError, input, mutation, submit };
}
