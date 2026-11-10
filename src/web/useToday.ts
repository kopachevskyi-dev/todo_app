import { systemClock } from '../shared/clock';
import { localDate } from '../domain/time';
import { browserTimeZone } from './dates';

export function today() {
  return localDate(systemClock.now(), browserTimeZone());
}
