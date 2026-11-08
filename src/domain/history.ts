export interface HistoryEvent {
  taskId: string;
  type: string;
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
  void day;
  void events;
  void timeZone;
  throw new Error('not implemented');
}

/** Ids of tasks with a `missed` event for `day`. */
export function missedTaskIds(day: string, events: HistoryEvent[]): string[] {
  void day;
  void events;
  throw new Error('not implemented');
}

/** Day summary: "4 of 5 done · 1 moved to backlog", "3 planned", "No plan". */
export function historySummary(
  counts: HistorySummaryCounts,
  kind: 'past' | 'today' | 'future',
): string {
  void counts;
  void kind;
  throw new Error('not implemented');
}
