import type { UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, Icon, TaskRow } from './components';
import { Capture } from './Capture';
import { Fragment, type RefObject } from 'react';
import type { List } from '../shared/contract';
import { useCompletion } from './useCompletion';

export function Today({
  mobile,
  today,
  activeList,
  scope,
  backlogCount,
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
  onCapture: () => void;
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
          {(backlogCount > 0 || (today.data?.progress.total ?? 0) > 0) && (
            <Button ref={planButton} variant="outline" onClick={openPlanner}>
              <Icon name="backlog" size={18} />
              Add from Backlog
            </Button>
          )}
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
              />
            </Fragment>
          ))}
      </ul>
    </>
  );
}
