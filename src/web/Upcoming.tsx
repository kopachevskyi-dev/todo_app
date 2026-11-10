import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from './api';
import { Button, EmptyPanel, TaskRow } from './components';
import { dateLabel } from './dates';
import type { useCompletion } from './useCompletion';

export function Upcoming({
  upcoming,
  task,
  onOpen,
  completion,
}: {
  upcoming: UseQueryResult<Awaited<ReturnType<typeof api.upcoming>>>;
  task?: string;
  onOpen: (id: string) => void;
  completion: ReturnType<typeof useCompletion>;
}) {
  if (upcoming.isPending) return <p role="status">Loading upcoming tasks…</p>;
  if (upcoming.isError)
    return (
      <p role="alert" className="field-error">
        Could not load upcoming tasks.{' '}
        <Button variant="outline" onClick={() => void upcoming.refetch()}>
          Try again
        </Button>
      </p>
    );
  if (!upcoming.data.days.length)
    return (
      <EmptyPanel>
        <h2>Nothing planned ahead</h2>
        <p>Tasks you plan for a future day will appear here.</p>
        <Link to="/backlog">Plan from Backlog</Link>
      </EmptyPanel>
    );
  return (
    <div className="upcoming-agenda">
      {upcoming.data.days.map(({ day, tasks }) => (
        <section key={day} aria-labelledby={`upcoming-${day}`}>
          <div className="history-day-heading">
            <h2 id={`upcoming-${day}`}>
              {dateLabel(day, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </h2>
          </div>
          <ul className="task-list">
            {tasks.map((row) => (
              <TaskRow
                key={row.id}
                task={row}
                selected={task === row.id}
                href={`/upcoming?task=${row.id}`}
                onOpen={() => onOpen(row.id)}
                onToggle={() =>
                  completion.mutateAsync({ id: row.id, completed: true })
                }
                pending={completion.isPending}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
