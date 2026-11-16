import type { UseQueryResult } from '@tanstack/react-query';
import { api } from './api';
import { Button, EmptyPanel, TaskRow } from './components';
import { searchLocationText } from '../domain/search';
export function Search({
  search,
  q,
  task,
  openTask,
  list,
}: {
  list?: string;
  search: UseQueryResult<Awaited<ReturnType<typeof api.search>>>;
  q?: string;
  task?: string;
  openTask: (id: string) => void;
}) {
  const results = search.data?.results.filter(
    (row) =>
      !list || Boolean(row.listId && list.split(',').includes(row.listId)),
  );
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
      {results?.length === 0 && <EmptyPanel>No tasks match</EmptyPanel>}
      <ul className="task-list">
        {results?.map((row) => (
          <TaskRow
            key={row.id}
            task={row}
            selected={row.id === task}
            location={searchLocationText(row.location)}
            href={`/search?${new URLSearchParams({ q: q ?? '', ...(list ? { lists: list } : {}), task: row.id })}`}
            onOpen={() => openTask(row.id)}
          />
        ))}
      </ul>
    </>
  );
}
