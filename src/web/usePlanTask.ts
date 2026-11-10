import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { api } from './api';
import type { RefObject } from 'react';
import type { TaskDetailData } from './task-detail-types';
export function usePlanTask(
  task: TaskDetailData['task'],
  planning: boolean,
  setPlanning: (value: boolean) => void,
  setChosenDay: (value: string | null | undefined) => void,
  setError: (value: string | undefined) => void,
  flushDescription: () => void,
  queue: RefObject<Promise<void>>,
) {
  const client = useQueryClient();
  const plan = async (target: string | null) => {
    if (planning) return;
    setPlanning(true);
    flushDescription();
    await queue.current;
    try {
      const result = await api.planTask(task.id, target);
      client.setQueryData<TaskDetailData>(
        queryKeys.taskDetail(task.id),
        (value) => (value ? { ...value, task: result.task } : value),
      );
      if (
        target &&
        !task.day &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const row = document.querySelector<HTMLElement>(
          `[data-layout-id="${task.id}"]`,
        );
        if (row)
          await row
            .animate(
              [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'translateX(12px)' },
              ],
              { duration: 140, easing: 'ease-out' },
            )
            .finished.catch(() => undefined);
      }
      setChosenDay(undefined);
      setError(undefined);
      await Promise.all(
        [
          queryKeys.taskDetail(task.id),
          queryKeys.backlog,
          queryKeys.today,
          queryKeys.counts,
          queryKeys.search,
          queryKeys.dayLoad,
          queryKeys.history,
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not plan the task. Try again.',
      );
    } finally {
      setPlanning(false);
    }
  };
  return plan;
}
