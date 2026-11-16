import type { List } from '../shared/contract';

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
      {lists.map((list) => (
        <button key={list.id} onClick={() => onFilter(list.id)}>
          <span
            className="by-list-bar"
            style={{ background: list.color }}
            aria-hidden="true"
          />
          <span>{list.name}</span>
          <span>{tasks.filter((task) => task.listId === list.id).length}</span>
        </button>
      ))}
    </section>
  );
}
