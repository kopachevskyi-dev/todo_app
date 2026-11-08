/** The list and subtask count shown beneath a task title. */
export function taskMeta(
  listName: string | null,
  subtaskCount: number,
): string {
  return [
    listName,
    subtaskCount > 0
      ? `${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
