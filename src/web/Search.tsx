import type { UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, TaskRow } from './components';
import { searchLocationText } from '../domain/search';
export function Search({
  search,
  q,
  task,
  openTask,
}: {
  search: UseQueryResult<Awaited<ReturnType<typeof api.search>>>;
  q?: string;
  task?: string;
  openTask: (id: string) => void;
}) {
  return (
    <>
      {search.isPending && <p role="status">Searching…</p>}
      {search.isError && (
        <p role="alert" className="field-error">
          Could not search tasks.{' '}
          <Button
            variant="outline"
            onClick={() => {
              void search.refetch();
            }}
          >
            Try again
          </Button>
        </p>
      )}
      {search.data?.results.length === 0 && (
        <EmptyPanel>No tasks match</EmptyPanel>
      )}
      <ul className="task-list">
        {search.data?.results.map((row) => (
          <TaskRow
            key={row.id}
            task={row}
            selected={row.id === task}
            location={searchLocationText(row.location)}
            href={`/search?${new URLSearchParams({ q: q ?? '', task: row.id })}`}
            onOpen={() => openTask(row.id)}
          />
        ))}
      </ul>
    </>
  );
}
