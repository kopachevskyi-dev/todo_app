import { Icon, SectionLabel } from './components';
import { completionTime } from './dates';
import type { z } from 'zod';
import type { historyResponseSchema } from '../shared/contract';
type Day = z.infer<typeof historyResponseSchema>['days'][number];
export function HistoryDayGroups({
  selected,
  weekStart,
  list,
  task,
  onOpen,
}: {
  selected: Day;
  weekStart: string;
  list?: string;
  task?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      {(['done', 'notDone', 'planned'] as const).map((group) => {
        const rows = selected.groups[group];
        if (!rows.length) return null;
        return (
          <div key={group} className="history-group">
            <SectionLabel>
              {group === 'notDone' ? 'NOT DONE' : group.toUpperCase()} ·{' '}
              {rows.length}
            </SectionLabel>
            <ul className="task-list">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={`task-row history-row ${group === 'notDone' ? 'missed' : group} ${task === row.id ? 'selected' : ''}`}
                >
                  <a
                    href={`/history?${new URLSearchParams({ week: weekStart, day: selected.day, ...(list ? { list } : {}), task: row.id })}`}
                    onClick={(event) => {
                      if (
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        onOpen(row.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowDown' ||
                        event.key === 'ArrowUp'
                      ) {
                        event.preventDefault();
                        const next =
                          event.key === 'ArrowDown'
                            ? event.currentTarget.parentElement
                                ?.nextElementSibling
                            : event.currentTarget.parentElement
                                ?.previousElementSibling;
                        next?.querySelector('a')?.focus();
                      }
                    }}
                    aria-current={task === row.id ? 'true' : undefined}
                  >
                    <span
                      className="check-hit"
                      role="checkbox"
                      aria-checked={group === 'done'}
                      aria-disabled="true"
                      aria-label={`Completion of ${row.title}`}
                    >
                      <span
                        className={`checkbox ${group === 'done' ? 'checked' : ''}`}
                      >
                        {group === 'done' && <Icon name="check" size={14} />}
                      </span>
                    </span>
                    <span className="row-text">
                      <span className="row-title">{row.title}</span>
                      {(row.list || group === 'notDone') && (
                        <span className="row-meta">
                          {row.list && (
                            <>
                              <span
                                className="list-dot"
                                style={{ background: row.list.color }}
                              />
                              {row.list.name}
                            </>
                          )}
                          {row.list && group === 'notDone' ? ' · ' : ''}
                          {group === 'notDone' ? 'moved to backlog' : ''}
                        </span>
                      )}
                    </span>
                    {group === 'done' && row.completedAt && (
                      <time
                        className="completion-time"
                        dateTime={row.completedAt}
                      >
                        {completionTime(row.completedAt)}
                      </time>
                    )}
                    {group === 'planned' && <Icon name="chevron" size={18} />}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
