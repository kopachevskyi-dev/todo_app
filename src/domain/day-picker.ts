import { localDate } from './time';

export interface DayPickerItem {
  key: 'today' | 'tomorrow' | 'weekend';
  label: string;
  day: string;
}

/** Today / Tomorrow / Weekend items for the day picker. */
export function dayPickerItems(now: Date, timeZone: string): DayPickerItem[] {
  const today = localDate(now, timeZone);
  const tomorrow = addDays(today, 1);
  let weekend = addDays(tomorrow, 1);
  while (new Date(`${weekend}T12:00:00Z`).getUTCDay() !== 6)
    weekend = addDays(weekend, 1);
  return (
    [
      ['today', 'Today', today],
      ['tomorrow', 'Tomorrow', tomorrow],
      ['weekend', 'Weekend', weekend],
    ] as const
  ).map(([key, prefix, day]) => ({
    key,
    day,
    label: `${prefix}, ${formatDay(day, false)}`,
  }));
}

export function loadLabel(count: number): string {
  return count === 0 ? 'Free' : `${count} ${count === 1 ? 'task' : 'tasks'}`;
}

export function planButtonLabel(chosen: string | null, today: string): string {
  return !chosen
    ? 'Choose a day'
    : chosen === today
      ? 'Plan for today'
      : `Plan for ${formatDay(chosen)}`;
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatDay(day: string, month = true): string {
  if (!month) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
    }).format(new Date(`${day}T12:00:00Z`));
    return `${weekday} ${Number(day.slice(-2))}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    ...(month ? ({ month: 'short' } as const) : {}),
    day: 'numeric',
  }).format(new Date(`${day}T12:00:00Z`));
}
