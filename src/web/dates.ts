export {
  dateLabel,
  formatShortDate,
  formatActivityTimestamp,
  completionTime,
} from '../shared/dates';
export const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
