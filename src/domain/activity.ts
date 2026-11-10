import { dateLabel } from '../shared/dates';
import type { ActivityType } from '../shared/contract';
export type DetailPart = 'description' | 'list' | 'subtasks';

/** A stored task event; `details_added` keeps its parts in `data.parts`. */
export interface ActivityEvent {
  type: ActivityType;
  at: string;
  day?: string | null;
  data?: { parts?: DetailPart[]; listName?: string } | null;
}

export interface DetailsEditResult {
  kind: 'update' | 'create';
  at: string;
  parts: DetailPart[];
}

/** Merge an edit into the latest `details_added` event when it is within 15 minutes. */
export function applyDetailsEdit(
  latest: { at: string; parts: DetailPart[] } | null,
  part: DetailPart,
  now: Date,
): DetailsEditResult {
  const elapsed = latest
    ? now.getTime() - new Date(latest.at).getTime()
    : Infinity;
  if (latest && elapsed >= 0 && elapsed <= 15 * 60 * 1000)
    return {
      kind: 'update',
      at: latest.at,
      parts: [...new Set([...latest.parts, part])],
    };
  return { kind: 'create', at: now.toISOString(), parts: [part] };
}

export function activityText(event: ActivityEvent): string {
  const day = event.day
    ? dateLabel(event.day, { month: 'short', day: 'numeric' })
    : '';
  switch (event.type) {
    case 'added_to_backlog':
      return 'added to backlog';
    case 'added_to_today':
      return 'added to today';
    case 'details_added': {
      const parts = event.data?.parts ?? [];
      if (parts.length === 1 && parts[0] === 'list' && event.data?.listName)
        return `list set to ${event.data.listName}`;
      const words =
        parts.length > 1
          ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
          : parts.join('');
      return `${words} added`;
    }
    case 'planned':
      return `planned for ${day}`;
    case 'completed':
      return 'completed';
    case 'reopened':
      return 'reopened';
    case 'moved_to_backlog':
      return 'moved to backlog';
    case 'missed':
      return `missed ${day}, moved to backlog`;
    default:
      return event.type;
  }
}
