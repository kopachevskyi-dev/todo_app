import { formatShortDate } from '../shared/dates';
import { localDate } from './time';

export type SearchableTask = { title: string; description: string };
export type LocatedTask = { day: string | null; completedAt: string | null };

/** Trimmed query, or null when it is empty and therefore invalid. */
export function parseSearchQuery(raw: string): string | null {
  return raw.trim() || null;
}

/** Case-insensitive substring match on title and description. */
export function matchesQuery(task: SearchableTask, query: string): boolean {
  const needle = query.toLowerCase();
  return [task.title, task.description].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

export function searchLocation(
  task: LocatedTask,
  today: string,
  timeZone: string,
) {
  if (task.completedAt)
    return {
      kind: 'done' as const,
      day: localDate(new Date(task.completedAt), timeZone),
    };
  if (!task.day) return { kind: 'backlog' as const, day: null };
  return {
    kind: task.day === today ? ('today' as const) : ('planned' as const),
    day: task.day,
  };
}

export function searchLocationText(
  location: ReturnType<typeof searchLocation>,
): string {
  if (location.kind === 'backlog') return 'Backlog';
  if (location.kind === 'today') return 'Today';
  const day = formatShortDate(location.day!, 'UTC');
  return location.kind === 'done' ? `Done · ${day}` : day;
}
