/** Swap visible neighbors in the full cached order, retaining hidden slots. */
export function moveTodayTask<T extends { id: string }>(
  open: T[],
  visible: readonly { id: string }[],
  id: string,
  direction: -1 | 1,
): T[] | undefined {
  // Rendered props can lag behind an optimistic cache update. Use them only
  // for filter membership; derive adjacency from the latest cached order.
  const visibleIds = new Set(visible.map((task) => task.id));
  const orderedVisible = open.filter((task) => visibleIds.has(task.id));
  const index = orderedVisible.findIndex((task) => task.id === id);
  if (index < 0) return;
  const neighbor = orderedVisible[index + direction];
  if (!neighbor) return;
  const from = open.findIndex((task) => task.id === id);
  const to = open.findIndex((task) => task.id === neighbor.id);
  if (from < 0 || to < 0) return;
  const next = [...open];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
