export type SearchableTask = { title: string; description: string };
export type LocatedTask = { day: string | null; completedAt: string | null };

/** Trimmed query, or null when it is empty and therefore invalid. */
export function parseSearchQuery(raw: string): string | null {
  void raw;
  throw new Error('not implemented');
}

/** Case-insensitive substring match on title and description. */
export function matchesQuery(task: SearchableTask, query: string): boolean {
  void task;
  void query;
  throw new Error('not implemented');
}

/** "Backlog", "Today", "Thu, Nov 12" or "Done · Wed, Nov 4". */
export function locationText(
  task: LocatedTask,
  today: string,
  timeZone: string,
): string {
  void task;
  void today;
  void timeZone;
  throw new Error('not implemented');
}
