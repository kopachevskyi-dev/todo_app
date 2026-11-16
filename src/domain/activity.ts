import { dateLabel } from '../shared/dates';
import type { ActivityType } from '../shared/contract';

/** A stored task event, including legacy detail edits. */
export interface ActivityEvent {
  type: ActivityType;
  at: string;
  day?: string | null;
  data?: { parts?: string[]; listName?: string } | null;
}

export interface ActivityLine {
  type: 'added' | 'planned' | 'returned' | 'completed';
  at: string;
  day: string | null;
  text: string;
}

/**
 * Stored kind → v3 activity (events arrive in chronological order):
 * added_to_backlog → added, "Added to Backlog"
 * added_to_today → added + planned, "Added to Backlog" + "Planned for {day}"
 * planned → planned, "Planned for {day}"
 * completed → completed, "Completed"
 * moved_to_backlog / missed → returned, "Returned to Backlog"
 * details_added → hidden
 * reopened → hidden; cancels the preceding completion
 */
export function activityLines(events: ActivityEvent[]): ActivityLine[] {
  const lines: ActivityLine[] = [];
  for (const event of events) {
    const add = (type: ActivityLine['type'], text: string) =>
      lines.push({ type, at: event.at, day: event.day ?? null, text });
    const plannedText = () =>
      `Planned for ${event.day ? dateLabel(event.day, { month: 'short', day: 'numeric' }) : ''}`;
    switch (event.type) {
      case 'added_to_backlog':
        add('added', 'Added to Backlog');
        break;
      case 'added_to_today':
        add('added', 'Added to Backlog');
        add('planned', plannedText());
        break;
      case 'planned':
        add('planned', plannedText());
        break;
      case 'completed':
        add('completed', 'Completed');
        break;
      case 'moved_to_backlog':
      case 'missed':
        add('returned', 'Returned to Backlog');
        break;
      case 'reopened': {
        const index = lines.findLastIndex((line) => line.type === 'completed');
        if (index !== -1) lines.splice(index, 1);
        break;
      }
      case 'details_added':
        break;
    }
  }
  return lines;
}
