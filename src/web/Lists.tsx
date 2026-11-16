import { type List } from '../shared/contract';

export function ListFilters({
  lists,
  active,
  onFilter,
  tasks,
  mobile = false,
}: {
  lists: List[];
  active: string[];
  onFilter: (id?: string) => void;
  tasks: { listId: string | null }[];
  mobile?: boolean;
}) {
  return (
    <div role="group" aria-label="Filter by list" className="list-chips">
      {!mobile && (
        <button
          className="list-link"
          aria-pressed={!active.length}
          onClick={() => onFilter()}
        >
          All <span className="chip-count">{tasks.length}</span>
        </button>
      )}
      {lists.map((list) => (
        <button
          key={list.id}
          className="list-link"
          aria-pressed={active.includes(list.id)}
          onClick={() => onFilter(list.id)}
        >
          <span className="list-dot" style={{ background: list.color }} />
          {list.name}
          {!mobile && (
            <span className="chip-count">
              {' '}
              {tasks.filter((task) => task.listId === list.id).length}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
