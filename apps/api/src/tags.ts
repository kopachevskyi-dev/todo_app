import { Router } from 'express';
import type { Pool } from 'pg';

export function tagRoutes(pool: Pool) {
  const router = Router();
  router.get('/tags', async (_request, response) => {
    response.json((await pool.query('SELECT id, name, color FROM planner.tags ORDER BY lower(name)')).rows);
  });
  function valid(body: Record<string, unknown>, creating: boolean) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['name', 'color'].includes(key))) return false;
    if ((creating || 'name' in body) && (typeof body.name !== 'string' || !body.name.trim())) return false;
    if ((creating || 'color' in body) && (typeof body.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(body.color))) return false;
    return true;
  }
  for (const method of ['post', 'patch'] as const) router[method](method === 'post' ? '/tags' : '/tags/:id', async (request, response, next) => {
    if (!valid(request.body, method === 'post')) { response.status(400).json({ message: 'Enter a tag name and a color in #RRGGBB format.' }); return; }
    try {
      const { name, color } = request.body;
      const result = method === 'post'
        ? await pool.query('INSERT INTO planner.tags (name, color) VALUES ($1, $2) RETURNING id, name, color', [name.trim(), color])
        : await pool.query('UPDATE planner.tags SET name = COALESCE($2, name), color = COALESCE($3, color) WHERE id::text = $1 RETURNING id, name, color', [(request.params as { id: string }).id, name?.trim(), color]);
      if (!result.rows.length) { response.status(404).json({ message: 'Tag not found.' }); return; }
      response.status(method === 'post' ? 201 : 200).json(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') { response.status(400).json({ message: 'A tag with that name already exists.' }); return; }
      next(error);
    }
  });
  router.delete('/tags/:id', async (request, response) => {
    const { rows } = await pool.query('DELETE FROM planner.tags WHERE id::text = $1 RETURNING id, name, color', [request.params.id]);
    if (!rows.length) { response.status(404).json({ message: 'Tag not found.' }); return; }
    response.json(rows[0]);
  });
  return router;
}
