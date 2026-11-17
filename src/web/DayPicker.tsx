import { browserTimeZone } from './dates';
import { queryKeys } from './query-keys';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dayPickerItems, loadLabel } from '../domain/day-picker';
import { localDate } from '../domain/time';
import { api } from './api';
import { BottomSheet, Icon, Modal } from './components';

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
  const picker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    picker.current
      ?.querySelector<HTMLButtonElement>(
        '.day-option[aria-pressed="true"], .day-option',
      )
      ?.focus();
  }, []);
  const items = dayPickerItems(now, zone);
  const from = today;
  const to = items[2]!.day;
  const load = useQuery({
    queryKey: queryKeys.dayLoadRange(from, to),
    queryFn: () => api.dayLoad(from, to),
  });
  const count = (day: string) =>
    load.data ? loadLabel(load.data.days[day] ?? 0) : '…';
  return (
    <div
      className="day-picker"
      ref={picker}
      onKeyDown={(event) => {
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
          {selected === item.day && <Icon name="check" size={16} />}
        </button>
      ))}
      <button
        type="button"
        className={`day-option backlog-option ${selected === null ? 'selected-day' : ''}`}
        aria-pressed={selected === null}
        onClick={() => onChoose(null)}
      >
        Move to Backlog{selected === null && <Icon name="check" size={16} />}
      </button>
      {load.isError && <p role="alert">Could not load planned task counts.</p>}
    </div>
  );
}

export function DayPickerDialog({
  mobile,
  onClose,
  ...props
}: Parameters<typeof DayPicker>[0] & {
  mobile: boolean;
  onClose: () => void;
}) {
  const Container = mobile ? BottomSheet : Modal;
  return (
    <Container label="Choose a day" className="day-dialog" onClose={onClose}>
      <h3>Choose a day</h3>
      <DayPicker {...props} />
    </Container>
  );
}
