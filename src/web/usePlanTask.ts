import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { queryKeys } from './query-keys';
import { invalidateTaskQueries } from './invalidate-task-queries';
import { api } from './api';
import { useNotification } from './notification-context';
import { browserTimeZone } from './dates';
import { formatDay } from '../domain/day-picker';
import { historyWeekStart } from '../domain/history';
import { localDate } from '../domain/time';
import type { TaskDetailData } from './task-detail-types';

export function usePlanTask(
  task: TaskDetailData['task'],
  setPlanning: (value: boolean) => void,
  setError: (value: string | undefined) => void,
  flushDescription: () => void,
  queue: RefObject<Promise<void>>,
) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotification();
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [failedTarget, setFailedTarget] = useState<string | null | undefined>();
  const plan = async (target: string | null) => {
    if (busy.current) return;
    busy.current = true;
    setPlanning(true);
    setError(undefined);
    setFailedTarget(undefined);
    flushDescription();
    const operation = queue.current.then(async () => {
      const previous =
        client.getQueryData<TaskDetailData>(queryKeys.taskDetail(task.id))?.task
          .day ?? null;
      try {
        const result = await api.planTask(task.id, target);
        client.setQueryData<TaskDetailData>(
          queryKeys.taskDetail(task.id),
          (value) => (value ? { ...value, task: result.task } : value),
        );
        if (
          target &&
          !previous &&
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
        await invalidateTaskQueries(client, [task.id]);
        const clock = client.getQueryData<{ now: string }>(queryKeys.clock);
        const today = clock
          ? localDate(new Date(clock.now), browserTimeZone())
          : undefined;
        notify({
          message: `Moved to ${target === null ? 'Backlog' : target === today ? 'Today' : formatDay(target)}`,
          actions: [
            { label: 'Undo', onClick: () => void plan(previous) },
            {
              label: 'Open day',
              onClick: () => {
                if (target === null)
                  void navigate({ to: '/backlog', search: {} });
                else if (target === today)
                  void navigate({ to: '/today', search: {} });
                else
                  void navigate({
                    to: '/history',
                    search: { week: historyWeekStart(target), day: target },
                  });
              },
            },
          ],
        });
      } catch (failure) {
        const message =
          failure instanceof Error
            ? failure.message
            : 'Could not plan the task. Try again.';
        setError(message);
        setFailedTarget(target);
        // Keep Retry available even when the card was closed before the failure.
        if (!mounted.current)
          notify({
            message,
            actions: [{ label: 'Retry', onClick: () => void plan(target) }],
          });
      } finally {
        busy.current = false;
        setPlanning(false);
      }
    });
    queue.current = operation;
    await operation;
  };
  return { plan, failedTarget };
}
