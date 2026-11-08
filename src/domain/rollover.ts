import { localDate, startOfLocalDay } from './time';

export interface RolloverCandidate {
  id: string;
  day: string | null;
  completedAt: string | null;
}

export interface RolloverChange {
  id: string;
  day: null;
  missedFrom: string;
  placedAt: string;
  event: { type: 'missed'; day: string; at: string };
}

/** Changes that send every unfinished task planned for a past day to the backlog. */
export function rolloverTasks(
  now: Date,
  timeZone: string,
  candidates: RolloverCandidate[],
): RolloverChange[] {
  const today = localDate(now, timeZone);
  const overdue = candidates.filter(
    (task) =>
      task.day !== null && task.day < today && task.completedAt === null,
  );
  if (!overdue.length) return [];
  const at = startOfLocalDay(now, timeZone).toISOString();
  return overdue.map((task) => ({
    id: task.id,
    day: null,
    missedFrom: task.day!,
    placedAt: at,
    event: { type: 'missed', day: task.day!, at },
  }));
}
