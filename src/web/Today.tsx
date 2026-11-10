import type { UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, Icon, TaskRow } from './components';
import { Capture } from './Capture';
import type { RefObject } from 'react';
import type { List } from '../shared/contract';
import { useCompletion } from './useCompletion';

export function Today({
  mobile,
  today,
  activeList,
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
  planButton: RefObject<HTMLButtonElement | null>;
  openPlanner: () => void;
  rowContainer: RefObject<HTMLUListElement | null>;
  task?: string;
  list?: string;
  openTask: (id: string) => void;
  completion: ReturnType<typeof useCompletion>;
}) {
  return (
    <>
      {!mobile && (
        <div className="today-capture">
          <Capture target="today" list={activeList} />
          <Button ref={planButton} variant="outline" onClick={openPlanner}>
            <Icon name="backlog" size={18} />
            From backlog
          </Button>
        </div>
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
      {today.data?.progress.total === 0 && (
        <EmptyPanel>
          Nothing planned for today. Add a task or pull one from the backlog.
        </EmptyPanel>
      )}
      <ul ref={rowContainer} className="task-list today-list">
        {today.data &&
          [...today.data.open, ...today.data.done].map((row, index) => (
            <TaskRow
              key={row.id}
              task={row}
              selected={row.id === task}
              href={`/today?${new URLSearchParams({ ...(list ? { list } : {}), task: row.id })}`}
              onOpen={() => openTask(row.id)}
              onToggle={() =>
                completion.mutateAsync({
                  id: row.id,
                  completed: !row.completedAt,
                })
              }
              pending={completion.isPending}
              section={
                index === today.data.open.length && today.data.done.length > 0
                  ? `DONE · ${today.data.done.length}`
                  : undefined
              }
            />
          ))}
      </ul>
    </>
  );
}
