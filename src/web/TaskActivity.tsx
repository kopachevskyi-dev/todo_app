import { browserTimeZone } from './dates';
import type { TaskDetailData } from './task-detail-types';
import { formatActivityTimestamp } from './dates';
export function TaskActivity({ detail }: { detail: TaskDetailData }) {
  return (
    <section className="activity">
      <h3>Activity</h3>
      <ul>
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
    </section>
  );
}
