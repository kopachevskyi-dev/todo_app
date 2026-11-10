import { dateLabel } from './dates';
import { browserTimeZone } from './dates';
import { queryKeys } from './query-keys';
import { HistoryDayGroups } from './HistoryDayGroups';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';
import { addDays } from '../domain/day-picker';
import { historySummary, historyWeekStart } from '../domain/history';
import { localDate } from '../domain/time';
import { api } from './api';
import { Button, Icon } from './components';

const fullDay = (day: string) =>
  dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric' });

function weekLabel(start: string) {
  const end = addDays(start, 6);
  return `${dateLabel(start, { month: 'short', day: 'numeric' })}–${
    start.slice(0, 7) === end.slice(0, 7)
      ? Number(end.slice(-2))
      : dateLabel(end, { month: 'short', day: 'numeric' })
  }`;
}

export function History({ onOpen }: { onOpen: (id: string) => void }) {
  const { week, day, list, task } = useSearch({ strict: false });
  const navigate = useNavigate();
  const lists = useQuery({ queryKey: queryKeys.lists, queryFn: api.lists });
  const clock = useQuery({ queryKey: queryKeys.clock, queryFn: api.clock });
  const today = clock.data
    ? localDate(new Date(clock.data.now), browserTimeZone())
    : undefined;
  const validWeek = z.iso.date().safeParse(week);
  const weekStart =
    validWeek.success && historyWeekStart(validWeek.data) === validWeek.data
      ? validWeek.data
      : today
        ? historyWeekStart(today)
        : undefined;
  const history = useQuery({
    queryKey: queryKeys.historyWeek(weekStart, list, today),
    queryFn: () => api.history(weekStart!, list),
    enabled: Boolean(weekStart),
  });
  const days = history.data?.days;
  const selected =
    days?.find((item) => item.day === day) ??
    days?.find((item) => item.day === today) ??
    days?.find((item) => item.done + item.notDone + item.planned > 0) ??
    days?.[0];
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusDay = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selected || !weekStart) return;
    if (week !== weekStart || day !== selected.day)
      void navigate({
        to: '/history',
        search: (previous) => ({
          ...previous,
          week: weekStart,
          day: selected.day,
        }),
        replace: true,
      });
    if (focusDay.current === selected.day) {
      buttons.current.get(selected.day)?.focus();
      focusDay.current = undefined;
    }
  }, [selected, weekStart, week, day, navigate]);
  const choose = (target: string, focus = false) => {
    if (focus) focusDay.current = target;
    void navigate({
      to: '/history',
      search: (previous) => ({
        ...previous,
        week: historyWeekStart(target),
        day: target,
        task: undefined,
      }),
    });
  };
  const pageWeek = (offset: number) => {
    if (selected) choose(addDays(selected.day, offset));
  };
  if (clock.isError || history.isError)
    return (
      <p role="alert" className="field-error">
        Could not load history.{' '}
        <Button
          variant="outline"
          onClick={() => {
            void clock.refetch();
            void history.refetch();
          }}
        >
          Try again
        </Button>
      </p>
    );
  if (!history.data || !selected) return <p role="status">Loading history…</p>;
  const kind =
    selected.day < history.data.today
      ? 'past'
      : selected.day === history.data.today
        ? 'today'
        : 'future';
  const empty = !selected.done && !selected.notDone && !selected.planned;
  return (
    <div className="history-view">
      <div className="history-toolbar">
        <p>
          {weekLabel(history.data.weekStart)}
          <span className="desktop-subtitle">
            {' '}
            · what you planned and what you finished
          </span>
        </p>
        <div className="week-arrows">
          <Button
            variant="icon"
            aria-label="Previous week"
            onClick={() => pageWeek(-7)}
          >
            <span className="previous-arrow">
              <Icon name="chevron" size={18} />
            </span>
          </Button>
          <Button
            variant="icon"
            aria-label="Next week"
            onClick={() => pageWeek(7)}
          >
            <Icon name="chevron" size={18} />
          </Button>
        </div>
      </div>
      <select
        className="history-mobile-filter"
        aria-label="Filter by list"
        value={list ?? ''}
        onChange={(event) => {
          void navigate({
            to: '/history',
            search: (previous) => ({
              ...previous,
              list: event.target.value || undefined,
              task: undefined,
            }),
          });
        }}
      >
        <option value="">All lists</option>
        {lists.data?.lists.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <div className="week-strip" role="group" aria-label="Week days">
        {history.data.days.map((item) => {
          const future = item.day > history.data.today;
          const total = item.done + item.notDone + item.planned;
          const ratio = future
            ? item.planned
              ? `${item.planned} planned`
              : 'No plan'
            : total
              ? `${item.done} of ${total}`
              : 'No plan';
          const active = item.day === selected.day;
          const label = `${fullDay(item.day)}: ${ratio}${!future && total ? ' done' : ''}${active ? ', selected' : ''}`;
          const weekday = dateLabel(item.day, { weekday: 'short' });
          return (
            <button
              key={item.day}
              ref={(node) => {
                if (node) buttons.current.set(item.day, node);
                else buttons.current.delete(item.day);
              }}
              type="button"
              className={`week-cell ${!total ? 'empty-day' : ''}`}
              aria-label={label}
              aria-pressed={active}
              aria-current={
                item.day === history.data.today ? 'date' : undefined
              }
              tabIndex={active ? 0 : -1}
              onClick={() => choose(item.day)}
              onKeyDown={(event) => {
                const offset =
                  event.key === 'ArrowRight'
                    ? 1
                    : event.key === 'ArrowLeft'
                      ? -1
                      : undefined;
                if (
                  offset !== undefined ||
                  event.key === 'Home' ||
                  event.key === 'End'
                ) {
                  event.preventDefault();
                  choose(
                    offset !== undefined
                      ? addDays(item.day, offset)
                      : addDays(
                          history.data.weekStart,
                          event.key === 'Home' ? 0 : 6,
                        ),
                    true,
                  );
                }
              }}
            >
              <span className="week-weekday">
                <span className="desktop-weekday">
                  {weekday}
                  {item.day === history.data.today ? ' · today' : ''}
                </span>
                <span className="mobile-weekday">{weekday[0]}</span>
              </span>
              <span className="week-number">{Number(item.day.slice(-2))}</span>
              <span className="week-track" aria-hidden="true">
                <span
                  className="week-fill"
                  style={{ width: `${total ? (item.done / total) * 100 : 0}%` }}
                />
              </span>
              <span className="week-ratio">{ratio}</span>
            </button>
          );
        })}
      </div>
      <section
        key={selected.day}
        className="history-day"
        aria-label={fullDay(selected.day)}
      >
        <div className="history-day-heading">
          <h2>{fullDay(selected.day)}</h2>
          <p>
            {empty
              ? 'Nothing planned this day.'
              : historySummary(selected, kind)}
          </p>
        </div>
        <HistoryDayGroups
          selected={selected}
          weekStart={history.data.weekStart}
          list={list}
          task={task}
          onOpen={onOpen}
        />
      </section>
    </div>
  );
}
