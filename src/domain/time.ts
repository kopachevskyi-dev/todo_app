/** Convert an injected instant to a calendar date without consulting the clock. */
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** First instant of the current local day, including days with offset changes. */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  const day = localDate(now, timeZone);
  let before = now.getTime() - 48 * 60 * 60 * 1000;
  let start = now.getTime();
  // Search the date boundary instead of assuming the day has 24 hours or that
  // midnight uses the same UTC offset as the supplied instant.
  while (start - before > 1) {
    const middle = Math.floor((before + start) / 2);
    if (localDate(new Date(middle), timeZone) < day) before = middle;
    else start = middle;
  }
  return new Date(start);
}

export function isTimeZone(value: string | undefined): value is string {
  if (!value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
