export interface RolloverCandidate {
  id: string;
  day: string | null;
  completedAt: string | null;
}

export interface RolloverChange {
  id: string;
  day: null;
  missedFrom: string;
  placedAt: string;
  event: { type: 'missed'; day: string; at: string };
}

/** Changes that send every unfinished task planned for a past day to the backlog. */
export function rolloverTasks(
  now: Date,
  timeZone: string,
  candidates: RolloverCandidate[],
): RolloverChange[] {
  throw new Error(
    `not implemented: ${now.toISOString()} ${timeZone} ${candidates.length}`,
  );
}
