import type { Pool } from 'pg';
import type { Clock } from './clock.js';

export function planDates(clock: Clock) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: clock.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(clock.now());
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return [today, next.toISOString().slice(0, 10)];
}

export async function rollover(pool: Pool, clock: Clock) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize rollover across simultaneous requests and server instances.
    await client.query('SELECT pg_advisory_xact_lock(817422)');
    await client.query(`WITH closed AS (
      UPDATE planner.tasks SET status = 'not_done'
      WHERE placement <> 'backlog' AND placement < $1 AND status = 'open' AND deleted_at IS NULL
      RETURNING id, title, note, priority, placement
    ), mapped AS MATERIALIZED (
      SELECT closed.*, gen_random_uuid() AS copy_id FROM closed
    ), copies AS (
      INSERT INTO planner.tasks (id, title, note, priority, placement, not_done_from, created_at)
      SELECT copy_id, title, note, priority, 'backlog', placement::date, $2 FROM mapped
    ) INSERT INTO planner.task_tags (task_id, tag_id)
      SELECT mapped.copy_id, link.tag_id FROM mapped JOIN planner.task_tags link ON link.task_id = mapped.id`, [planDates(clock)[0], clock.now()]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
