import { useId, useState } from 'react';
import { Button } from './components';
import { browserTimeZone } from './dates';
import type { TaskDetailData } from './task-detail-types';
import { formatActivityTimestamp } from './dates';
export function TaskActivity({ detail }: { detail: TaskDetailData }) {
  const [expanded, setExpanded] = useState(Boolean(detail.task.completedAt));
  const id = useId();
  return (
    <section className="activity">
      <h3>
        <Button
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          Activity ({detail.activity.length})
        </Button>
      </h3>
      {expanded && (
        <ul id={id}>
          {detail.activity.map((item, index) => (
            <li
              key={`${item.at}-${index}`}
              className={item.type === 'completed' ? 'completed-event' : ''}
            >
              <span aria-hidden="true" className="activity-dot" />
              <span>
                {formatActivityTimestamp(item.at, browserTimeZone())} —{' '}
                <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
