export type TodayTask = {
  day: string | null;
  completedAt: string | null;
  placedAt: string;
};

export type TodayView<T extends TodayTask> = {
  open: T[];
  done: T[];
  progress: { done: number; total: number };
};

/** Tasks planned for `today`: open (newest placed first), done (by completion), progress. */
export function todayView<T extends TodayTask>(
  tasks: T[],
  today: string,
): TodayView<T> {
  void [tasks, today];
  throw new Error('todayView is not implemented');
}
