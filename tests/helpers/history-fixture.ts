/** Sends a JSON request to the app under test (in-process or over HTTP). */
export type Send = (
  method: string,
  path: string,
  body?: unknown,
) => Response | Promise<Response>;

export const LICENSE = "Renew driver's license";

// Design fixture (design-language section 7), week Nov 2-8: [day, done, missed].
// Sunday (today) has 1 done and 2 still planned. Sat has no tasks.
const week: [string, string, number, number][] = [
  ['Mon', '2026-11-02', 3, 0],
  ['Tue', '2026-11-03', 4, 1],
  ['Wed', '2026-11-04', 4, 1],
  ['Thu', '2026-11-05', 3, 1],
  ['Fri', '2026-11-06', 2, 0],
];

/**
 * Seeds the Nov 2-8 week through the API with the test clock (New York, EST),
 * leaving the clock at Sun Nov 8, 12:00 PM. Needs `testClock` enabled.
 * Wed's first done task is the license, completed Nov 4 at 2:20 PM; Wed's
 * missed task is "Call the dentist". Returns task ids by title.
 */
export async function seedHistoryWeek(send: Send) {
  const ids: Record<string, string> = {};
  const setClock = async (now: string) => {
    const response = await send('PUT', '/api/test/clock', { now });
    if (!response.ok) throw new Error(`clock ${now}: ${response.status}`);
  };
  const create = async (title: string) => {
    const response = await send('POST', '/api/tasks', {
      title,
      target: 'today',
    });
    if (response.status !== 201) throw new Error(`create ${title}`);
    ids[title] = ((await response.json()) as { task: { id: string } }).task.id;
  };
  const complete = async (title: string, now: string) => {
    await setClock(now);
    const response = await send('POST', `/api/tasks/${ids[title]}/complete`);
    if (!response.ok) throw new Error(`complete ${title}`);
  };
  for (const [name, date, done, missed] of week) {
    await setClock(`${date}T15:00:00.000Z`);
    const doneTitles = Array.from({ length: done }, (_, i) =>
      name === 'Wed' && i === 0 ? LICENSE : `${name} done ${i + 1}`,
    );
    const missedTitles = Array.from({ length: missed }, (_, i) =>
      name === 'Wed' ? 'Call the dentist' : `${name} missed ${i + 1}`,
    );
    for (const title of [...doneTitles, ...missedTitles]) await create(title);
    for (const [i, title] of doneTitles.entries())
      await complete(title, `${date}T19:${20 + i}:00.000Z`);
  }
  await setClock('2026-11-08T15:00:00.000Z');
  for (const title of ['Sun done 1', 'Sun open 1', 'Sun open 2'])
    await create(title);
  await complete('Sun done 1', '2026-11-08T15:05:00.000Z');
  await setClock('2026-11-08T17:00:00.000Z');
  return ids;
}
