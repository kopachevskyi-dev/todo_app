import { Router } from 'express';
import type { Pool } from 'pg';
import type { Clock } from './clock.js';

export function taskRoutes(pool: Pool, clock: Clock) {
  const router = Router();
  const dates = () => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: clock.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(clock.now());
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const next = new Date(`${today}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return [today, next.toISOString().slice(0, 10)];
  };
  const fields = `id, title, note, priority, placement, position::float8 AS position, status,
    completed_at AS "completedAt", created_at AS "createdAt", deleted_at AS "deletedAt",
    COALESCE((SELECT json_agg(json_build_object('id', tag.id, 'name', tag.name, 'color', tag.color) ORDER BY lower(tag.name))
      FROM planner.task_tags link JOIN planner.tags tag ON tag.id = link.tag_id WHERE link.task_id = tasks.id), '[]'::json) AS tags`;
  router.get('/plan', async (request, response) => {
    const [today, tomorrow] = dates();
    const { rows } = await pool.query(`SELECT ${fields} FROM planner.tasks WHERE deleted_at IS NULL AND placement IN ('backlog', $1, $2)
      ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
      created_at DESC, position DESC`, [today, tomorrow]);
    const day = (date: string) => ({ date, tasks: rows.filter(t => t.placement === date).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.position - b.position) });
    response.json({ backlog: rows.filter(t => t.placement === 'backlog' && (!request.query.tagId || t.tags.some((tag: { id: string }) => tag.id === request.query.tagId))), today: day(today), tomorrow: day(tomorrow) });
  });
  function valid(body: Record<string, unknown>, creating: boolean) {
    const allowed = creating ? ['title', 'note', 'priority', 'placement'] : ['title', 'note', 'priority', 'status', 'tagIds'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) return false;
    if ((creating || 'title' in body) && (typeof body.title !== 'string' || !body.title.trim())) return false;
    if ('note' in body && body.note !== null && typeof body.note !== 'string') return false;
    if ('priority' in body && body.priority !== null && !['high', 'medium', 'low'].includes(body.priority as string)) return false;
    if ('tagIds' in body && (!Array.isArray(body.tagIds) || body.tagIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) || new Set(body.tagIds).size !== body.tagIds.length)) return false;
    if ('status' in body && !['open', 'done'].includes(body.status as string)) return false;
    if (creating && !['backlog', ...dates()].includes(body.placement as string)) return false;
    return true;
  }
  router.post('/tasks', async (request, response) => {
    if (!valid(request.body, true)) { response.status(400).json({ message: 'Enter a title and a valid placement, note and priority.' }); return; }
    const { title, note = null, priority = null, placement } = request.body;
    const { rows } = await pool.query(`INSERT INTO planner.tasks (title, note, priority, placement, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING ${fields}`, [title.trim(), note, priority, placement, clock.now()]);
    response.status(201).json(rows[0]);
  });
  router.patch('/tasks/:id', async (request, response) => {
    if (!valid(request.body, false)) { response.status(400).json({ message: 'Use a non-empty title, text note, valid priority and open or done status.' }); return; }
    const values: unknown[] = [request.params.id];
    const assignments = Object.entries(request.body).filter(([key]) => key !== 'tagIds').map(([key, value]) => {
      values.push(key === 'title' ? (value as string).trim() : value);
      return `${key} = $${values.length}`;
    });
    if ('status' in request.body) { values.push(request.body.status === 'done' ? clock.now() : null); assignments.push(`completed_at = $${values.length}`); }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { tagIds } = request.body;
      if (tagIds) {
        const tags = await client.query('SELECT id FROM planner.tags WHERE id = ANY($1::uuid[]) FOR KEY SHARE', [tagIds]);
        if (tags.rows.length !== tagIds.length) { await client.query('ROLLBACK'); response.status(400).json({ message: 'Choose tags from the tag list.' }); return; }
      }
      const { rows } = await client.query(`UPDATE planner.tasks SET ${assignments.length ? assignments.join(', ') : 'title = title'} WHERE id::text = $1 AND deleted_at IS NULL RETURNING id`, values);
      if (!rows.length) { await client.query('ROLLBACK'); response.status(404).json({ message: 'Task not found.' }); return; }
      if (tagIds) {
        await client.query('DELETE FROM planner.task_tags WHERE task_id = $1', [rows[0].id]);
        await client.query('INSERT INTO planner.task_tags (task_id, tag_id) SELECT $1, unnest($2::uuid[])', [rows[0].id, tagIds]);
      }
      const updated = await client.query(`SELECT ${fields} FROM planner.tasks WHERE id = $1`, [rows[0].id]);
      await client.query('COMMIT');
      response.json(updated.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
  router.delete('/tasks/:id', async (request, response) => {
    const { rows } = await pool.query(`UPDATE planner.tasks SET deleted_at = $2 WHERE id::text = $1 AND deleted_at IS NULL RETURNING ${fields}`, [request.params.id, clock.now()]);
    if (!rows.length) { response.status(404).json({ message: 'Task not found.' }); return; }
    response.json(rows[0]);
  });
  router.post('/tasks/:id/restore', async (request, response) => {
    const { rows } = await pool.query(`UPDATE planner.tasks SET deleted_at = NULL WHERE id::text = $1 RETURNING ${fields}`, [request.params.id]);
    if (!rows.length) { response.status(404).json({ message: 'Task not found.' }); return; }
    response.json(rows[0]);
  });
  return router;
}
