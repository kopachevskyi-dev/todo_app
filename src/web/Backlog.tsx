import type { UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, Icon, TaskRow } from './components';
import { Capture } from './Capture';
import type { RefObject } from 'react';
import type { List } from '../shared/contract';
import { useCompletion } from './useCompletion';

export function Backlog({
  mobile,
  backlog,
  activeList,
  rowContainer,
  task,
  list,
  openTask,
  completion,
}: {
  mobile: boolean;
  backlog: UseQueryResult<Awaited<ReturnType<typeof api.backlog>>>;
  activeList?: List;
  rowContainer: RefObject<HTMLUListElement | null>;
  task?: string;
  list?: string;
  openTask: (id: string) => void;
  completion: ReturnType<typeof useCompletion>;
}) {
  return (
    <>
      {!mobile && <Capture target="backlog" list={activeList} />}
      {backlog.isPending && <p role="status">Loading tasks…</p>}
      {backlog.isError && (
        <p role="alert" className="field-error">
          <Icon name="error" size={16} />
          Could not load tasks.{' '}
          <Button
            variant="outline"
            onClick={() => {
              void backlog.refetch();
            }}
          >
            Try again
          </Button>
        </p>
      )}
      {backlog.data?.tasks?.length === 0 && (
        <EmptyPanel>
          {list
            ? 'No matching tasks in Backlog'
            : 'Nothing waiting. Add a task above.'}
        </EmptyPanel>
      )}
      <ul ref={rowContainer} className="task-list">
        {backlog.data?.tasks?.map((row) => {
          const params = new URLSearchParams({
            ...(list ? { lists: list } : {}),
            task: row.id,
          });
          return (
            <TaskRow
              key={row.id}
              task={row}
              selected={row.id === task}
              onToggle={() =>
                completion.mutateAsync({ id: row.id, completed: true })
              }
              pending={completion.isPending}
              href={`/backlog?${params}`}
              onOpen={() => openTask(row.id)}
            />
          );
        })}
      </ul>
    </>
  );
}
