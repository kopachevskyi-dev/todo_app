import type { testApp } from './app';

/** Default instant of the contract fixtures (America/New_York is the test app's zone). */
export const exampleInstant = '2026-11-10T14:00:00.000Z';
/** The day before `exampleInstant` in New York. */
export const dayBeforeExample = '2026-11-09';

type App = ReturnType<typeof testApp>;

/** Fixes the clock of an app created with `testClock: true`. */
export async function setClock(app: App, now: string) {
  const response = await app.request('/api/test/clock', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ now }),
  });
  if (!response.ok) throw new Error(`clock ${now}: ${response.status}`);
}

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
