import { formatShortDate } from '../shared/dates';
/** Row meta: `{List} · from Wed, Nov 4 · 3 subtasks`. */
export function rowMetaText(task: {
  listName: string | null;
  missedFrom: string | null;
  subtaskCount: number;
}): string {
  const parts: string[] = [];
  if (task.listName) parts.push(task.listName);
  if (task.missedFrom) {
    const day = formatShortDate(task.missedFrom, 'UTC');
    parts.push(`from ${day}`);
  }
  if (task.subtaskCount > 0)
    parts.push(
      `${task.subtaskCount} ${task.subtaskCount === 1 ? 'subtask' : 'subtasks'}`,
    );
  return parts.join(' · ');
}
