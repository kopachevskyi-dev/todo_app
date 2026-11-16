import type { List, TaskRow } from '../shared/contract';
import { waitingWidget } from './backlog-widgets';
import { ByListWidget } from './ByListWidget';
import { QuickAddWidget } from './QuickAddWidget';
import { StatWidget } from './StatWidget';

export function BacklogWidgets({
  showQuickAdd,
  tasks,
  lists,
  activeList,
  filteredIds,
  onSelectList,
}: {
  showQuickAdd: boolean;
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
      <ByListWidget lists={lists} tasks={tasks} onFilter={onSelectList} />
      {showQuickAdd && (
        <QuickAddWidget
          target="backlog"
          list={activeList}
          filteredIds={filteredIds}
        />
      )}
    </div>
  );
}
