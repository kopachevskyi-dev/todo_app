import type { TaskRow } from '../shared/contract';
import { Button } from './components';

export function TodayHero({
  task,
  onOpen,
  onComplete,
  pending,
}: {
  task?: TaskRow;
  onOpen: (id: string) => void;
  onComplete: (id: string) => void;
  pending: boolean;
}) {
  if (!task) return null;
  return (
    <section className="today-hero" aria-label="Up next">
      <div className="hero-pills">
        <span>Up next</span>
        <span>
          {task.list && (
            <span
              className="list-dot"
              style={{ background: task.list.color }}
            />
          )}
          {task.list?.name ?? 'No list'}
        </span>
      </div>
      <div>
        <h2>{task.title}</h2>
        <p>
          {task.subtaskCount > 0
            ? `${task.subtaskDoneCount} of ${task.subtaskCount} subtasks done`
            : task.description.split('\n')[0] || 'No details yet'}
        </p>
      </div>
      <div className="hero-actions">
        <Button variant="outline" onClick={() => onOpen(task.id)}>
          Open
        </Button>
        <Button disabled={pending} onClick={() => onComplete(task.id)}>
          Mark done
        </Button>
      </div>
    </section>
  );
}
