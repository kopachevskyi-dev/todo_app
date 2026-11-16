import type { List } from '../shared/contract';
import { byListWidget } from './backlog-widgets';

export function ByListWidget({
  lists,
  tasks,
  onFilter,
}: {
  lists: List[];
  tasks: { listId: string | null }[];
  onFilter: (id: string) => void;
}) {
  return (
    <section className="widget-card by-list-widget" aria-label="By list">
      <div className="widget-heading">
        <h2>By list</h2>
      </div>
      {byListWidget(tasks, lists).map((list) => (
        <button key={list.id} onClick={() => onFilter(list.id)}>
          <span
            className="by-list-bar"
            style={{ background: list.color }}
            aria-hidden="true"
          />
          <span>{list.name}</span>
          <span>{list.count}</span>
        </button>
      ))}
    </section>
  );
}
