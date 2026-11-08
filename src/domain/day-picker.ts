export interface DayPickerItem {
  key: 'today' | 'tomorrow' | 'weekend';
  label: string;
  day: string;
}

/** Today / Tomorrow / Weekend items for the day picker. */
export function dayPickerItems(now: Date, timeZone: string): DayPickerItem[] {
  void [now, timeZone];
  throw new Error('not implemented');
}

export function loadLabel(count: number): string {
  void count;
  throw new Error('not implemented');
}

export function planButtonLabel(chosen: string | null, today: string): string {
  void [chosen, today];
  throw new Error('not implemented');
}
