import { api } from './api';
import { queryKeys } from './query-keys';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PatchTaskRequest, TaskRow, List } from '../shared/contract';
import type { TaskDetailData } from './task-detail-types';
export function useTaskEditor(
  task: TaskDetailData['task'],
  lists: { data?: { lists: List[] } },
  setError: (error: string | undefined) => void,
) {
  const client = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDescription = useRef<string | undefined>(undefined);
  const savedTitle = useRef(task.title);
  const cancellingTitle = useRef(false);
  const queue = useRef(Promise.resolve());

  const save = (input: PatchTaskRequest) => {
    queue.current = queue.current.then(async () => {
      await Promise.all([
        client.cancelQueries({ queryKey: queryKeys.taskDetail(task.id) }),
        client.cancelQueries({ queryKey: queryKeys.backlog }),
      ]);
      const previous = client.getQueryData<TaskDetailData>(
        queryKeys.taskDetail(task.id),
      );
      const rows = client.getQueriesData<{ tasks: TaskRow[] }>({
        queryKey: queryKeys.backlog,
      });
      client.setQueryData<TaskDetailData>(
        queryKeys.taskDetail(task.id),
        (value) =>
          value ? { ...value, task: { ...value.task, ...input } } : value,
      );
      for (const [key, value] of rows) {
        client.setQueryData(
          key,
          value && {
            tasks: value.tasks.flatMap((row) => {
              if (row.id !== task.id) return [row];
              const updated = {
                ...row,
                ...input,
                list:
                  input.listId === undefined
                    ? row.list
                    : (lists.data?.lists.find(
                        (list) => list.id === input.listId,
                      ) ?? null),
              };
              return key[1] && updated.listId !== key[1] ? [] : [updated];
            }),
          },
        );
      }
      try {
        const result = await api.patchTask(task.id, input);
        if (input.title !== undefined) savedTitle.current = result.task.title;
        client.setQueryData<TaskDetailData>(
          queryKeys.taskDetail(task.id),
          (value) => (value ? { ...value, task: result.task } : value),
        );
        setError(undefined);
      } catch (failure) {
        client.setQueryData(queryKeys.taskDetail(task.id), previous);
        for (const [key, value] of rows) client.setQueryData(key, value);
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not save the task. Try again.',
        );
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.taskDetail(task.id) }),
        client.invalidateQueries({ queryKey: queryKeys.backlog }),
        client.invalidateQueries({ queryKey: queryKeys.today }),
        client.invalidateQueries({ queryKey: queryKeys.search }),
        client.invalidateQueries({ queryKey: queryKeys.history }),
      ]);
    });
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const flushDescription = () => {
    clearTimeout(timer.current);
    const value = pendingDescription.current;
    pendingDescription.current = undefined;
    if (value !== undefined) saveRef.current({ description: value });
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pendingDescription.current !== undefined)
        saveRef.current({ description: pendingDescription.current });
      pendingDescription.current = undefined;
    },
    [],
  );
  const saveTitle = () => {
    if (cancellingTitle.current) {
      cancellingTitle.current = false;
      return;
    }
    const value = title.trim();
    if (!value) {
      setTitle(savedTitle.current);
      return;
    }
    setTitle(value);
    if (value !== savedTitle.current) save({ title: value });
  };
  const cancelTitle = () => {
    cancellingTitle.current = true;
    setTitle(savedTitle.current);
  };
  const changeDescription = (value: string) => {
    setDescription(value);
    pendingDescription.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flushDescription, 500);
  };
  return {
    title,
    setTitle,
    description,
    changeDescription,
    cancelTitle,
    saveTitle,
    save,
    queue,
    flushDescription,
  };
}
