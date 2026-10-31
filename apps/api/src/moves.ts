import type { PoolClient } from 'pg';

// The caller holds the planner transaction lock, shared with rollover.
export async function moveTask(client: PoolClient, id: string, placement: string, position: number | undefined, today: string) {
  const { rows } = await client.query('SELECT id, placement FROM planner.tasks WHERE id::text = $1 AND deleted_at IS NULL FOR UPDATE', [id]);
  const task = rows[0];
  if (!task) return 404;
  if (task.placement !== 'backlog' && task.placement < today) return 409;
  const target = await client.query(`SELECT id FROM planner.tasks WHERE placement = $1 AND deleted_at IS NULL AND id <> $2
    ORDER BY (status = 'done'), position, id FOR UPDATE`, [placement, task.id]);
  const ids: string[] = target.rows.map(row => row.id);
  ids.splice(Math.min(position ?? ids.length, ids.length), 0, task.id);
  await client.query('UPDATE planner.tasks SET placement = $2, not_done_from = NULL WHERE id = $1', [task.id, placement]);
  if (placement !== 'backlog') await client.query(`UPDATE planner.tasks SET position = ordered.index - 1
    FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(id, index) WHERE tasks.id = ordered.id`, [ids]);
  if (task.placement !== 'backlog' && task.placement !== placement) await client.query(`WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY (status = 'done'), position, id) - 1 AS position
    FROM planner.tasks WHERE placement = $1 AND deleted_at IS NULL
  ) UPDATE planner.tasks SET position = ordered.position FROM ordered WHERE tasks.id = ordered.id`, [task.placement]);
  return 200;
}
