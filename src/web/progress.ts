export type ProgressWidget = {
  badge: string;
  percent: number;
  unit: string;
  fill: number;
};

export function progressWidget(counts: {
  done: number;
  total: number;
}): ProgressWidget {
  const fill = counts.total ? (counts.done / counts.total) * 100 : 0;
  return {
    badge: `${counts.done} of ${counts.total}`,
    percent: Math.round(fill),
    unit: '% of today',
    fill,
  };
}

export type ThisWeekWidget = {
  badge: string;
  number: number;
  unit: string;
  fill: number;
};

export function thisWeekWidget(
  tasks: { day: string }[],
  today: string,
): ThisWeekWidget {
  void tasks;
  void today;
  throw new Error('not implemented');
}
