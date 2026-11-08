import { useRef, useState } from 'react';
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
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localDate(now, zone);
  const [calendar, setCalendar] = useState(false);
  const [month, setMonth] = useState(
    (selected && selected >= today ? selected : today).slice(0, 7),
  );
  const [focused, setFocused] = useState(
    selected && selected >= today ? selected : today,
  );
  const grid = useRef<HTMLDivElement>(null);
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
    queryKey: ['day-load', from, to],
    queryFn: () => api.dayLoad(from, to),
  });
  const count = (day: string) =>
    load.data ? loadLabel(load.data.days[day] ?? 0) : '…';
  const leading = (new Date(`${monthStart}T12:00:00Z`).getUTCDay() + 6) % 7;
  const dates: string[] = [];
  for (let day = monthStart; day <= end; day = addDays(day, 1)) dates.push(day);
  return (
    <div className="day-picker">
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
              {new Intl.DateTimeFormat('en-US', {
                timeZone: 'UTC',
                month: 'long',
                year: 'numeric',
              }).format(new Date(`${monthStart}T12:00:00Z`))}
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
                className={`calendar-day ${selected === day ? 'selected-day' : ''}`}
                aria-label={`${formatDay(day)} — ${count(day)}`}
                aria-current={day === today ? 'date' : undefined}
                aria-pressed={selected === day}
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
                onClick={() => onChoose(day)}
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
