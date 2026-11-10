import type { ActivityType } from '../shared/contract';
import { localDate } from './time';
import { addDays } from './day-picker';
import type { TaskRow } from '../shared/contract';

export interface HistoryEvent {
  taskId: string;
  type: ActivityType;
  at: string;
  day?: string | null;
}

export type HistorySummaryCounts = {
  done: number;
  notDone: number;
  planned: number;
};

/** Ids of tasks done on a past local `day`, in completion order. */
export function doneTaskIds(
  day: string,
  events: HistoryEvent[],
  timeZone: string,
): string[] {
  const completed = new Map<string, string>();
  for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    if (localDate(new Date(event.at), timeZone) !== day) continue;
    if (event.type === 'completed') completed.set(event.taskId, event.at);
    if (event.type === 'reopened') completed.delete(event.taskId);
  }
  return [...completed]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id]) => id);
}

/** Ids of tasks with a `missed` event for `day`. */
export function missedTaskIds(day: string, events: HistoryEvent[]): string[] {
  return [
    ...new Set(
      events
        .filter((event) => event.type === 'missed' && event.day === day)
        .map((event) => event.taskId),
    ),
  ];
}

/** Day summary: "4 of 5 done · 1 moved to backlog", "3 planned", "No plan". */
export function historySummary(
  counts: HistorySummaryCounts,
  kind: 'past' | 'today' | 'future',
): string {
  const { done, notDone, planned } = counts;
  if (kind === 'future') return planned ? `${planned} planned` : 'No plan';
  const total = done + notDone + planned;
  if (!total) return 'No plan';
  return `${done} of ${total} done${notDone ? ` · ${notDone} moved to backlog` : ''}`;
}

export function historyWeekStart(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

export function historyView(
  rows: TaskRow[],
  events: HistoryEvent[],
  weekStart: string,
  now: Date,
  zone: string,
) {
  const today = localDate(now, zone);
  const byId = new Map(rows.map((task) => [task.id, task]));
  const orderedEvents = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return {
    weekStart,
    today,
    days: Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      const done =
        day <= today
          ? doneGroupIds(day, orderedEvents).flatMap((id) => {
              const task = byId.get(id);
              if (!task) return [];
              const completedAt = orderedEvents.findLast(
                (event) =>
                  event.taskId === id &&
                  event.type === 'completed' &&
                  event.day === day,
              )!.at;
              return [{ ...task, completedAt }];
            })
          : [];
      const notDone =
        day < today
          ? missedTaskIds(day, events).flatMap((id) => {
              const task = byId.get(id);
              return task
                ? [{ ...task, completedAt: null, movedTo: 'backlog' as const }]
                : [];
            })
          : [];
      const planned =
        day >= today
          ? rows.filter((task) => task.day === day && !task.completedAt)
          : [];
      return {
        day,
        done: done.length,
        notDone: notDone.length,
        planned: planned.length,
        groups: { done, notDone, planned },
      };
    }),
  };
}

/** Ids of tasks with a `completed` event carrying `day`, minus later `reopened` events for that day. */
export function doneGroupIds(day: string, events: HistoryEvent[]): string[] {
  const completed = new Map<string, string>();
  for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    if (event.day !== day) continue;
    if (event.type === 'completed') completed.set(event.taskId, event.at);
    if (event.type === 'reopened') completed.delete(event.taskId);
  }
  return [...completed]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id]) => id);
}
