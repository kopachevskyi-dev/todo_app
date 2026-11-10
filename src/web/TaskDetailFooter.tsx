import { browserTimeZone } from './dates';
import { queryKeys } from './query-keys';
import type { RefObject } from 'react';
import type { TaskDetailData } from './task-detail-types';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { Button, Icon } from './components';
import { planButtonLabel } from '../domain/day-picker';
import { localDate } from '../domain/time';
import { useCompletion } from './useCompletion';
export function TaskDetailFooter({
  task,
  mobile,
  deleting,
  flushDescription,
  setConfirming,
  chosenDay,
  planning,
  clock,
  plan,
  day,
  setChoosingDay,
  history,
  setPlanning,
  queue,
  setError,
  onClose,
  completion,
}: {
  task: TaskDetailData['task'];
  mobile: boolean;
  deleting: boolean;
  flushDescription: () => void;
  setConfirming: (value: boolean) => void;
  chosenDay: string | null | undefined;
  planning: boolean;
  clock: { data?: { now: string } };
  plan: (target: string | null) => Promise<void>;
  day: string | null;
  setChoosingDay: (value: boolean) => void;
  history: boolean;
  setPlanning: (value: boolean) => void;
  queue: RefObject<Promise<void>>;
  setError: (value: string | undefined) => void;
  onClose: () => void;
  completion: ReturnType<typeof useCompletion>;
}) {
  const client = useQueryClient();
  return (
    <footer className="detail-footer">
      <Button
        variant={mobile ? 'icon' : 'outline'}
        aria-label={mobile ? 'Delete task' : undefined}
        disabled={deleting}
        onClick={() => {
          flushDescription();
          setConfirming(true);
        }}
      >
        {mobile ? <Icon name="trash" /> : 'Delete'}
      </Button>
      {!task.completedAt && (
        <Button
          className="plan-action"
          variant={task.day && chosenDay === undefined ? 'outline' : 'primary'}
          disabled={planning || !clock.data}
          onClick={() => {
            if (task.day && chosenDay === undefined) void plan(null);
            else if (day === null && !task.day) setChoosingDay(true);
            else void plan(day);
          }}
        >
          {task.day && chosenDay === undefined
            ? 'Move to backlog'
            : task.day && day === null
              ? 'Save'
              : clock.data
                ? planButtonLabel(
                    day,
                    localDate(new Date(clock.data.now), browserTimeZone()),
                  )
                : 'Choose a day'}
        </Button>
      )}
      {task.completedAt && (
        <Button
          variant="strong"
          className="reopen-button"
          disabled={completion.isPending || deleting || planning}
          onClick={() => {
            flushDescription();
            if (history) {
              setPlanning(true);
              void queue.current.then(async () => {
                try {
                  await api.moveToBacklog(task.id);
                  await Promise.all(
                    [
                      queryKeys.history,
                      queryKeys.backlog,
                      queryKeys.today,
                      queryKeys.counts,
                      queryKeys.task,
                      queryKeys.search,
                      queryKeys.dayLoad,
                    ].map((queryKey) => client.invalidateQueries({ queryKey })),
                  );
                  setError(undefined);
                  onClose();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : 'Could not move the task. Try again.',
                  );
                } finally {
                  setPlanning(false);
                }
              });
            } else {
              void queue.current.then(() =>
                completion.mutate({ id: task.id, completed: false }),
              );
            }
          }}
        >
          {history ? 'Move to backlog' : 'Reopen'}
        </Button>
      )}
    </footer>
  );
}
