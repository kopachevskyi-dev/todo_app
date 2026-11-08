import { encodeTime, ulid } from 'ulid';

/** Call at the server boundary with an instant obtained from its injected clock. */
export function createId(now: Date): string {
  // ulid(0) consults Date.now(); encode the injected time separately so even
  // the Unix epoch and invalid dates can never fall back to the system clock.
  return encodeTime(now.getTime()) + ulid(1).slice(10);
}
