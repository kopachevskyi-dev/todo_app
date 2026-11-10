import { queryKeys } from './query-keys';
import { useState } from 'react';
import type { RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Counts, TaskRow } from '../shared/contract';
import type { TaskDetailData } from './task-detail-types';
import { api } from './api';
export function useDeleteTask(
  task: TaskDetailData['task'],
  queue: RefObject<Promise<void>>,
  onClose: () => void,
  setConfirming: (value: boolean) => void,
  setError: (value: string | undefined) => void,
) {
  const client = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    await queue.current;
    await Promise.all([
      client.cancelQueries({ queryKey: queryKeys.backlog }),
      client.cancelQueries({ queryKey: queryKeys.counts }),
    ]);
    const rows = client.getQueriesData<{ tasks: TaskRow[] }>({
      queryKey: queryKeys.backlog,
    });
    const counts = client.getQueryData<Counts>(queryKeys.counts);
    for (const [key, value] of rows)
      client.setQueryData(
        key,
        value && { tasks: value.tasks.filter((row) => row.id !== task.id) },
      );
    if (counts && !task.day && !task.completedAt)
      client.setQueryData(queryKeys.counts, {
        ...counts,
        backlog: counts.backlog - 1,
      });
    try {
      await api.deleteTask(task.id);
      setConfirming(false);
      onClose();
    } catch (failure) {
      for (const [key, value] of rows) client.setQueryData(key, value);
      if (counts) client.setQueryData(queryKeys.counts, counts);
      setConfirming(false);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not delete the task. Try again.',
      );
    } finally {
      setDeleting(false);
      void client.invalidateQueries({ queryKey: queryKeys.today });
      void client.invalidateQueries({ queryKey: queryKeys.search });
      void client.invalidateQueries({ queryKey: queryKeys.history });
      void client.invalidateQueries({ queryKey: queryKeys.backlog });
      void client.invalidateQueries({ queryKey: queryKeys.counts });
    }
  };
  return { deleting, remove };
}
