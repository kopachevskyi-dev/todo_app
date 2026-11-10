import {
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, Icon, TaskRow } from './components';
import { Capture } from './Capture';
import { Fragment, type RefObject } from 'react';
import { queryKeys } from './query-keys';
import { moveTodayTask } from './today-order';
import { useNotification } from './notification-context';
import type { TodayResponse, List } from '../shared/contract';
import { useCompletion } from './useCompletion';

export function Today({
  mobile,
  today,
  activeList,
  scope,
  backlogCount,
  unfinishedCount,
  reviewButton,
  openReview,
  onCapture,
  planButton,
  openPlanner,
  rowContainer,
  task,
  list,
  openTask,
  completion,
}: {
  mobile: boolean;
  today: UseQueryResult<Awaited<ReturnType<typeof api.today>>>;
  activeList?: List;
  scope?: string;
  backlogCount: number;
  unfinishedCount: number;
  reviewButton: RefObject<HTMLButtonElement | null>;
  openReview: () => void;
  onCapture: () => void;
  planButton: RefObject<HTMLButtonElement | null>;
  openPlanner: () => void;
  rowContainer: RefObject<HTMLUListElement | null>;
  task?: string;
  list?: string;
  openTask: (id: string) => void;
  completion: ReturnType<typeof useCompletion>;
}) {
  const client = useQueryClient();
  const notify = useNotification();
  const order = useMutation({
    mutationKey: ['today-order'],
    scope: { id: 'today-order' },
    mutationFn: api.setTodayOrder,
    onError: () => notify({ message: 'Could not save task order. Try again.' }),
    onSettled: () => {
      if (client.isMutating({ mutationKey: ['today-order'] }) === 1)
        return client.invalidateQueries({ queryKey: queryKeys.today });
    },
  });
  const move = async (id: string, direction: -1 | 1) => {
    // Finish cancellation before reading/updating the cache so a previous
    // refetch cannot restore its snapshot over this optimistic move.
    await client.cancelQueries({ queryKey: queryKeys.today });
    const full = client.getQueryData<TodayResponse>(queryKeys.todayList());
    if (!full) return;
    const open = moveTodayTask(
      full.open,
      today.data?.open ?? [],
      id,
      direction,
    );
    if (!open) return;
    client.setQueryData(queryKeys.todayList(), { ...full, open });
    order.mutate(open.map((row) => row.id));
  };
  return (
    <>
      {!mobile && (
        <div className="today-capture">
          <Capture target="today" list={activeList} />
          {(backlogCount > 0 || (today.data?.progress.total ?? 0) > 0) && (
            <Button ref={planButton} variant="outline" onClick={openPlanner}>
              <Icon name="backlog" size={18} />
              Add from Backlog
            </Button>
          )}
        </div>
      )}
      {unfinishedCount > 0 && (
        <Button ref={reviewButton} variant="ghost" onClick={openReview}>
          Review {unfinishedCount} unfinished
        </Button>
      )}
      {today.isPending && <p role="status">Loading tasks…</p>}
      {today.isError && (
        <p role="alert" className="field-error">
          Could not load tasks.{' '}
          <Button
            variant="outline"
            onClick={() => {
              void today.refetch();
            }}
          >
            Try again
          </Button>
        </p>
      )}
      {today.data &&
        (list && today.data.open.length + today.data.done.length === 0 ? (
          <EmptyPanel>No {scope} tasks planned for today</EmptyPanel>
        ) : today.data.progress.total === 0 ? (
          <EmptyPanel>
            <p>Nothing planned for today</p>
            {backlogCount === 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  if (mobile) onCapture();
                  else
                    document
                      .querySelector<HTMLInputElement>('.today-capture input')
                      ?.focus();
                }}
              >
                Add a task
              </Button>
            )}
          </EmptyPanel>
        ) : today.data.progress.done === today.data.progress.total ? (
          <EmptyPanel>All done for today</EmptyPanel>
        ) : null)}
      <ul ref={rowContainer} className="task-list today-list">
        {today.data &&
          [...today.data.open, ...today.data.done].map((row, index) => (
            <Fragment key={row.id}>
              {index === today.data.open.length &&
                today.data.done.length > 0 && (
                  <li role="presentation" className="done-section">
                    <h2 className="section-label">Completed</h2>
                  </li>
                )}
              <TaskRow
                key={row.id}
                task={row}
                selected={row.id === task}
                href={`/today?${new URLSearchParams({ ...(list ? { lists: list } : {}), task: row.id })}`}
                onOpen={() => openTask(row.id)}
                onToggle={() =>
                  completion.mutateAsync({
                    id: row.id,
                    completed: !row.completedAt,
                  })
                }
                pending={completion.isPending}
                orderControls={
                  !row.completedAt && (
                    <span className="today-order-controls">
                      <Button
                        variant="icon"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => move(row.id, -1)}
                      >
                        <span aria-hidden="true">↑</span>
                      </Button>
                      <Button
                        variant="icon"
                        aria-label="Move down"
                        disabled={index === today.data.open.length - 1}
                        onClick={() => move(row.id, 1)}
                      >
                        <span aria-hidden="true">↓</span>
                      </Button>
                    </span>
                  )
                }
              />
            </Fragment>
          ))}
      </ul>
    </>
  );
}
