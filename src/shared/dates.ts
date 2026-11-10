export function dateLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${day}T12:00:00Z`));
}

// A local date has no offset; keep its calendar day in every time zone.
export function formatShortDate(day: string, zone: string): string {
  void zone;
  return dateLabel(day, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatActivityTimestamp(at: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(new Date(at));
  return `${day}, ${completionTime(at, timeZone)}`;
}

export function completionTime(at: string, timeZone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(at));
}
