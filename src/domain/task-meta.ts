import { rowMetaText } from './row-meta';

/** The list and subtask count shown beneath a task title. */
export function taskMeta(
  listName: string | null,
  subtaskCount: number,
): string {
  return rowMetaText({ listName, missedFrom: null, subtaskCount });
}
