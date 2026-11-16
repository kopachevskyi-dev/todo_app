import { useId, useState } from 'react';
import { Button, Icon } from './components';
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
          aria-label={`Activity (${detail.activity.length})`}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          Activity{' '}
          <span className="activity-count">· {detail.activity.length}</span>
          <span className={`activity-chevron ${expanded ? 'expanded' : ''}`}>
            <Icon name="chevron" size={14} />
          </span>
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
                <span className="activity-event">{item.text}</span>
                <time dateTime={item.at}>
                  {formatActivityTimestamp(item.at, browserTimeZone())}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
