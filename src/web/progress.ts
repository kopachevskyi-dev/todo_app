import { addDays } from '../domain/day-picker';

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
  const counts = days.reduce(
    (sum, day) => ({
      done: sum.done + day.done,
      total: sum.total + day.done + day.notDone + day.planned,
    }),
    { done: 0, total: 0 },
  );
  return { ...progressWidget(counts), unit: '% done' };
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
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const sunday = addDays(today, (7 - weekday) % 7);
  const planned = tasks.filter((task) => task.day <= sunday).length;
  return {
    badge: `${planned} planned`,
    number: tasks.length,
    unit: 'ahead',
    fill: tasks.length ? (planned / tasks.length) * 100 : 0,
  };
}
