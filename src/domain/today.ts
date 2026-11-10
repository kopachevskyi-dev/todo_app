export type TodayTask = {
  day: string | null;
  completedAt: string | null;
  placedAt: string;
  position?: number | null;
};

export type TodayView<T extends TodayTask> = {
  open: T[];
  done: T[];
  progress: { done: number; total: number };
};

/** Tasks planned for `today`: open (position first, then newest placed first), done (by completion), progress. */
export function todayView<T extends TodayTask>(
  tasks: T[],
  today: string,
): TodayView<T> {
  const planned = tasks.filter((task) => task.day === today);
  const open = planned
    .filter((task) => task.completedAt === null)
    .sort((a, b) => {
      if (a.position != null && b.position != null)
        return a.position - b.position;
      if (a.position != null) return -1;
      if (b.position != null) return 1;
      return b.placedAt.localeCompare(a.placedAt);
    });
  const done = planned
    .filter((task) => task.completedAt !== null)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
  return { open, done, progress: { done: done.length, total: planned.length } };
}
