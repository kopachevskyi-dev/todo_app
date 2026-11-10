import { browserTimeZone, dateLabel } from './dates';
import { queryKeys } from './query-keys';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  dayPickerItems,
  formatDay,
  loadLabel,
} from '../domain/day-picker';
import { localDate } from '../domain/time';
import { api } from './api';
import { Button, Icon } from './components';

export function DayPicker({
  now,
  selected,
  onChoose,
}: {
  now: Date;
  selected: string | null;
  onChoose: (day: string | null) => void;
}) {
  const zone = browserTimeZone();
  const today = localDate(now, zone);
  const [calendar, setCalendar] = useState(false);
  const [draft, setDraft] = useState(selected);
  const [month, setMonth] = useState(
    (selected && selected >= today ? selected : today).slice(0, 7),
  );
  const [focused, setFocused] = useState(
    selected && selected >= today ? selected : today,
  );
  const grid = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    picker.current
      ?.querySelector<HTMLButtonElement>(
        '.day-option[aria-pressed="true"], .day-option',
      )
      ?.focus();
  }, []);
  const monthStart = `${month}-01`;
  const nextMonth = (offset: number) => {
    const date = new Date(`${monthStart}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  };
  const end = addDays(`${nextMonth(1)}-01`, -1);
  const items = dayPickerItems(now, zone);
  const from = calendar ? monthStart : today;
  const to = calendar ? end : items[2]!.day;
  const load = useQuery({
    queryKey: queryKeys.dayLoadRange(from, to),
    queryFn: () => api.dayLoad(from, to),
  });
  const count = (day: string) =>
    load.data ? loadLabel(load.data.days[day] ?? 0) : '…';
  const leading = (new Date(`${monthStart}T12:00:00Z`).getUTCDay() + 6) % 7;
  const dates: string[] = [];
  for (let day = monthStart; day <= end; day = addDays(day, 1)) dates.push(day);
  return (
    <div
      className="day-picker"
      ref={picker}
      onKeyDown={(event) => {
        if (calendar) return;
        const options = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '.day-option',
          ),
        );
        const index = options.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        const next = {
          ArrowDown: (index + 1) % options.length,
          ArrowUp: (index - 1 + options.length) % options.length,
          Home: 0,
          End: options.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        options[next]?.focus();
      }}
    >
      {calendar ? (
        <>
          <div className="calendar-header">
            <Button
              variant="ghost"
              aria-label="Previous month"
              disabled={month <= today.slice(0, 7)}
              onClick={() => setMonth(nextMonth(-1))}
            >
              ‹
            </Button>
            <span>
              {dateLabel(monthStart, { month: 'long', year: 'numeric' })}
            </span>
            <Button
              variant="ghost"
              aria-label="Next month"
              onClick={() => setMonth(nextMonth(1))}
            >
              ›
            </Button>
          </div>
          <div className="calendar-grid" ref={grid}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span className="calendar-weekday" key={day}>
                {day}
              </span>
            ))}
            {Array.from({ length: leading }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {dates.map((day) => (
              <button
                type="button"
                key={day}
                data-day={day}
                className={`calendar-day ${draft === day ? 'selected-day' : ''}`}
                aria-label={`${formatDay(day)} — ${count(day)}`}
                aria-current={day === today ? 'date' : undefined}
                aria-pressed={draft === day}
                disabled={day < today}
                tabIndex={
                  day ===
                  (focused.slice(0, 7) === month
                    ? focused
                    : monthStart < today
                      ? today
                      : monthStart)
                    ? 0
                    : -1
                }
                onFocus={() => setFocused(day)}
                onClick={() => setDraft(day)}
                onKeyDown={(event) => {
                  const step = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  }[event.key];
                  if (!step) return;
                  event.preventDefault();
                  const target = addDays(day, step);
                  if (target < today) return;
                  setFocused(target);
                  setMonth(target.slice(0, 7));
                  requestAnimationFrame(() =>
                    grid.current
                      ?.querySelector<HTMLButtonElement>(
                        `[data-day="${target}"]`,
                      )
                      ?.focus(),
                  );
                }}
              >
                <span>{Number(day.slice(-2))}</span>
                {!!load.data?.days[day] && <small>{load.data.days[day]}</small>}
              </button>
            ))}
          </div>
          <Button
            disabled={!draft || draft < today}
            onClick={() => onChoose(draft)}
          >
            Save date
          </Button>
          <Button variant="ghost" onClick={() => setCalendar(false)}>
            Suggested days
          </Button>
        </>
      ) : (
        <>
          {items.map((item) => (
            <button
              type="button"
              className={`day-option ${selected === item.day ? 'selected-day' : ''}`}
              key={item.key}
              aria-pressed={selected === item.day}
              onClick={() => onChoose(item.day)}
            >
              <span>{item.label}</span>
              <span className="day-load">{count(item.day)}</span>
              {selected === item.day && <Icon name="check" size={18} />}
            </button>
          ))}
          <button
            type="button"
            className="day-option"
            onClick={() => setCalendar(true)}
          >
            <Icon name="today" size={18} />
            Pick a date…
          </button>
        </>
      )}
      <div className="day-divider" />
      <button
        type="button"
        className="day-option backlog-option"
        aria-pressed={selected === null}
        onClick={() => onChoose(null)}
      >
        Keep in backlog{selected === null && <Icon name="check" size={18} />}
      </button>
      {load.isError && <p role="alert">Could not load planned task counts.</p>}
    </div>
  );
}
