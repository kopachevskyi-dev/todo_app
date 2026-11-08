/** Row meta `{List} · {extra}`: the list name and "N subtasks", empty when neither applies. */
export function taskMeta(
  listName: string | null,
  subtaskCount: number,
): string {
  throw new Error(`not implemented: ${listName} ${subtaskCount}`);
}
