import type { List, TaskRow } from '../shared/contract';
import { byListWidget, waitingWidget } from './backlog-widgets';
import { QuickAddWidget } from './QuickAddWidget';
import { StatWidget } from './StatWidget';

export function BacklogWidgets({
  tasks,
  lists,
  activeList,
  filteredIds,
  onSelectList,
}: {
  tasks: TaskRow[];
  lists: List[];
  activeList?: List;
  filteredIds: string[];
  onSelectList: (id: string) => void;
}) {
  const waiting = waitingWidget(tasks);
  return (
    <div className="backlog-widgets">
      <div className={waiting.fill > 0 ? 'waiting-returned' : undefined}>
        <StatWidget title="Waiting" {...waiting} />
      </div>
      <section className="widget-card by-list-widget" aria-label="By list">
        <div className="widget-heading">
          <h2>By list</h2>
        </div>
        {byListWidget(tasks, lists).map((row) => (
          <button key={row.id} onClick={() => onSelectList(row.id)}>
            <span
              className="by-list-bar"
              style={{ background: row.color }}
              aria-hidden="true"
            />
            <span>{row.name}</span>
            <span>{row.count}</span>
          </button>
        ))}
      </section>
      <QuickAddWidget
        target="backlog"
        list={activeList}
        filteredIds={filteredIds}
      />
    </div>
  );
}
