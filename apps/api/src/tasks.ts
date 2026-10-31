import { Router } from 'express';
import type { Pool } from 'pg';
import type { Clock } from './clock.js';
import { planDates } from './rollover.js';

export function taskRoutes(pool: Pool, clock: Clock) {
  const router = Router();
  const dates = () => planDates(clock);
  const fields = `id, title, note, priority, placement, position::float8 AS position, status,
    not_done_from::text AS "notDoneFrom", completed_at AS "completedAt", created_at AS "createdAt", deleted_at AS "deletedAt"`;
  router.get('/days/:date', async (request, response) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request.params.date)) { response.status(400).json({ message: 'Use a calendar date.' }); return; }
    const { rows } = await pool.query(`SELECT ${fields} FROM planner.tasks WHERE placement = $1 AND deleted_at IS NULL ORDER BY position`, [request.params.date]);
    response.json({ date: request.params.date, tasks: rows });
  });
  router.use('/tasks/:id', async (request, response, next) => {
    if (!['PATCH', 'POST', 'DELETE'].includes(request.method)) { next(); return; }
    const { rows } = await pool.query('SELECT placement FROM planner.tasks WHERE id::text = $1', [request.params.id]);
    if (rows[0] && rows[0].placement !== 'backlog' && rows[0].placement < dates()[0]) {
      response.status(409).json({ message: 'Tasks on past days are read-only.' }); return;
    }
    next();
  });
  router.get('/plan', async (_request, response) => {
    const [today, tomorrow] = dates();
    const { rows } = await pool.query(`SELECT ${fields} FROM planner.tasks WHERE deleted_at IS NULL AND placement IN ('backlog', $1, $2)
      ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
      created_at DESC, position DESC`, [today, tomorrow]);
    const day = (date: string) => ({ date, tasks: rows.filter(t => t.placement === date).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.position - b.position) });
    response.json({ backlog: rows.filter(t => t.placement === 'backlog'), today: day(today), tomorrow: day(tomorrow) });
  });
  function valid(body: Record<string, unknown>, creating: boolean) {
    const allowed = creating ? ['title', 'note', 'priority', 'placement'] : ['title', 'note', 'priority', 'status'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) return false;
    if ((creating || 'title' in body) && (typeof body.title !== 'string' || !body.title.trim())) return false;
    if ('note' in body && body.note !== null && typeof body.note !== 'string') return false;
    if ('priority' in body && body.priority !== null && !['high', 'medium', 'low'].includes(body.priority as string)) return false;
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
  router.post('/tasks/:id/move', async (request, response) => {
    const placement = request.body?.placement;
    if (!['backlog', ...dates()].includes(placement)) { response.status(400).json({ message: 'Choose Backlog, Today or Tomorrow.' }); return; }
    const { rows } = await pool.query(`UPDATE planner.tasks SET placement = $2, not_done_from = NULL
      WHERE id::text = $1 AND deleted_at IS NULL RETURNING ${fields}`, [request.params.id, placement]);
    if (!rows.length) { response.status(404).json({ message: 'Task not found.' }); return; }
    response.json(rows[0]);
  });
  router.patch('/tasks/:id', async (request, response) => {
    if (!valid(request.body, false)) { response.status(400).json({ message: 'Use a non-empty title, text note, valid priority and open or done status.' }); return; }
    const values: unknown[] = [request.params.id];
    const assignments = Object.entries(request.body).map(([key, value]) => {
      values.push(key === 'title' ? (value as string).trim() : value);
      return `${key} = $${values.length}`;
    });
    if ('status' in request.body) { values.push(request.body.status === 'done' ? clock.now() : null); assignments.push(`completed_at = $${values.length}`); }
    const { rows } = await pool.query(`UPDATE planner.tasks SET ${assignments.length ? assignments.join(', ') : 'title = title'} WHERE id::text = $1 AND deleted_at IS NULL RETURNING ${fields}`, values);
    if (!rows.length) { response.status(404).json({ message: 'Task not found.' }); return; }
    response.json(rows[0]);
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
