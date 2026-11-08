export interface Clock {
  now(): Date;
}

/** The only application boundary allowed to read the system clock. */
export const systemClock: Clock = { now: () => new Date() };

export function createTestClock(base: Clock) {
  let instant: Date | undefined;
  return {
    now: () => new Date(instant ?? base.now()),
    set: (now: Date) => {
      instant = new Date(now);
    },
  };
}
