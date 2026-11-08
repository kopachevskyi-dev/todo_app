/** Row meta: `{List} · from Wed, Nov 4 · 3 subtasks`. */
export function rowMetaText(task: {
  listName: string | null;
  missedFrom: string | null;
  subtaskCount: number;
}): string {
  throw new Error(`not implemented: ${task.listName}`);
}
