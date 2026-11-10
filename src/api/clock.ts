import type { Clock } from '../shared/clock';
export { systemClock, type Clock } from '../shared/clock';

export function createTestClock(base: Clock) {
  let instant: Date | undefined;
  return {
    now: () => new Date(instant ?? base.now()),
    set: (now: Date) => {
      instant = new Date(now);
    },
  };
}
