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
  void tasks;
  throw new Error('not implemented');
}

export function byListWidget(
  tasks: { listId: string | null }[],
  lists: List[],
): ByListRow[] {
  void tasks;
  void lists;
  throw new Error('not implemented');
}
