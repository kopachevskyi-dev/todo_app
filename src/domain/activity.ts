export type DetailPart = 'description' | 'list' | 'subtasks';

/** A stored task event; `details_added` keeps its parts in `data.parts`. */
export interface ActivityEvent {
  type: string;
  at: string;
  day: string | null;
  data?: { parts?: DetailPart[]; listName?: string } | null;
}

/** `{Mon D}, {h:mm AM/PM} — {text}` in the given zone. */
export function formatActivityLine(
  event: ActivityEvent,
  timeZone: string,
): string {
  void [event, timeZone];
  throw new Error('not implemented');
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
  void [latest, part, now];
  throw new Error('not implemented');
}
