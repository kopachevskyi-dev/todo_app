import { invalidateTaskQueries } from './invalidate-task-queries';
import type { RefObject } from 'react';
import type { TaskDetailData } from './task-detail-types';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { Button } from './components';
import { useCompletion } from './useCompletion';
export function TaskDetailFooter({
  task,
  deleting,
  flushDescription,
  planning,
  history,
  setPlanning,
  queue,
  setError,
  onClose,
  completion,
}: {
  task: TaskDetailData['task'];
  deleting: boolean;
  flushDescription: () => void;
  planning: boolean;
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
                  await invalidateTaskQueries(client, [task.id]);
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
