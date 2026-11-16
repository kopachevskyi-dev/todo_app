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
                  {group === 'notDone' ? (
                    <div className="history-missed-content">
                      <span className="check-hit" aria-hidden="true">
                        <span className="checkbox" />
                      </span>
                      <span
                        className="list-dot row-list-bar"
                        style={{
                          background: row.list?.color ?? 'var(--check-border)',
                        }}
                        aria-hidden="true"
                      />
                      <span className="row-text">
                        <span className="row-title">{row.title}</span>
                        <span className="row-meta">
                          {row.list?.name ?? 'No list'} · moved to backlog
                        </span>
                      </span>
                      <span className="history-missed-tag">Missed</span>
                    </div>
                  ) : (
                    <a
                      href={`/history?${new URLSearchParams({ week: weekStart, day: selected.day, ...(list ? { lists: list } : {}), task: row.id })}`}
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
                        aria-label={group === 'done' ? 'Completed' : 'Planned'}
                      >
                        <span
                          className={`checkbox ${group === 'done' ? 'checked' : ''}`}
                        >
                          {group === 'done' && <Icon name="check" size={14} />}
                        </span>
                      </span>
                      <span
                        className="list-dot row-list-bar"
                        style={{
                          background: row.list?.color ?? 'var(--check-border)',
                        }}
                        aria-hidden="true"
                      />
                      <span className="row-text">
                        <span className="row-title">{row.title}</span>
                        {row.list && (
                          <span className="row-meta">{row.list?.name}</span>
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
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
