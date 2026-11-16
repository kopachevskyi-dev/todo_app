import type { UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, Icon, TaskRow } from './components';
import { Fragment, type RefObject } from 'react';
import { useCompletion } from './useCompletion';

export function Backlog({
  backlog,
  rowContainer,
  task,
  list,
  openTask,
  completion,
}: {
  backlog: UseQueryResult<Awaited<ReturnType<typeof api.backlog>>>;
  rowContainer: RefObject<HTMLUListElement | null>;
  task?: string;
  list?: string;
  openTask: (id: string) => void;
  completion: ReturnType<typeof useCompletion>;
}) {
  const tasks = backlog.data?.tasks ?? [];
  const unfinished = tasks.filter((row) => row.missedFrom);
  const waiting = tasks.filter((row) => !row.missedFrom);
  return (
    <>
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
          <strong>{list ? 'No matching tasks' : 'Nothing waiting'}</strong>
          <span>
            {list
              ? 'No Backlog tasks in the selected lists.'
              : 'Add a task to get started.'}
          </span>
        </EmptyPanel>
      )}
      <ul ref={rowContainer} className="task-list backlog-list">
        {[...unfinished, ...waiting].map((row, index) => {
          const params = new URLSearchParams({
            ...(list ? { lists: list } : {}),
            task: row.id,
          });
          return (
            <Fragment key={row.id}>
              {unfinished.length > 0 &&
                (index === 0 || index === unfinished.length) && (
                  <li role="presentation" className="backlog-section">
                    <h3 className="section-label">
                      {index === 0
                        ? `Unfinished from earlier · ${unfinished.length}`
                        : `Waiting · ${waiting.length}`}
                    </h3>
                  </li>
                )}
              <TaskRow
                task={row}
                showMissed
                selected={row.id === task}
                onToggle={() =>
                  completion.mutateAsync({ id: row.id, completed: true })
                }
                pending={completion.isPending}
                href={`/backlog?${params}`}
                onOpen={() => openTask(row.id)}
              />
            </Fragment>
          );
        })}
      </ul>
    </>
  );
}
