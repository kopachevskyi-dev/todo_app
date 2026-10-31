import { Router } from 'express';
import type { Pool } from 'pg';

export function historyRoutes(pool: Pool) {
  const router = Router();
  router.get('/history', async (request, response) => {
    const month = request.query.month;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) {
      response.status(400).json({ message: 'Choose a month in YYYY-MM format.' }); return;
    }
    const { rows } = await pool.query(`SELECT placement AS date, count(*)::int AS total,
      count(*) FILTER (WHERE status = 'done')::int AS done
      FROM planner.tasks WHERE deleted_at IS NULL
        AND placement >= $1::text AND placement < to_char($1::date + interval '1 month', 'YYYY-MM-DD')
      GROUP BY placement ORDER BY placement`, [`${month}-01`]);
    response.json({ month, days: rows });
  });
  return router;
}
