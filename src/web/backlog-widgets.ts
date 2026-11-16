import type { List } from '../shared/contract';

export type WaitingWidget = {
  badge: string;
  number: number;
  unit: string;
  fill: number;
};

export type ByListRow = {
  id: string;
  name: string;
  color: string;
  count: number;
};

export function waitingWidget(
  tasks: { missedFrom: string | null }[],
): WaitingWidget {
  const returned = tasks.filter((task) => task.missedFrom !== null).length;
  return {
    badge: returned ? `${returned} returned` : 'Clear',
    number: tasks.length,
    unit: tasks.length === 1 ? 'task' : 'tasks',
    fill: tasks.length ? (returned / tasks.length) * 100 : 0,
  };
}

export function byListWidget(
  tasks: { listId: string | null }[],
  lists: List[],
): ByListRow[] {
  return lists.map(({ id, name, color }) => ({
    id,
    name,
    color,
    count: tasks.filter((task) => task.listId === id).length,
  }));
}
