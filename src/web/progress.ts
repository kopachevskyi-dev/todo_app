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

export function weekWidget(
  days: { done: number; notDone: number; planned: number }[],
): ProgressWidget {
  void days;
  throw new Error('not implemented');
}
