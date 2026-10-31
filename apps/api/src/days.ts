import { Router } from 'express';
import type { Pool } from 'pg';
import type { Clock } from './clock.js';

export function todayDate(clock: Clock) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: clock.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(clock.now());
}

export async function readDay(pool: Pool, date: string) {
  const { rows } = await pool.query(`SELECT
    COALESCE((SELECT reflection FROM planner.days WHERE date = $1::date), '') AS reflection,
    COALESCE((SELECT reflection_prompt_dismissed FROM planner.days WHERE date = $1::date), false) AS "reflectionPromptDismissed",
    count(*)::int AS total, count(*) FILTER (WHERE status = 'done')::int AS done
    FROM planner.tasks WHERE placement = $1::text AND deleted_at IS NULL`, [date]);
  const day = { date, ...rows[0] };
  return { ...day, showReflectionPrompt: day.total > 0 && !day.reflection.trim() && !day.reflectionPromptDismissed };
}

export function dayRoutes(pool: Pool, clock: Clock) {
  const router = Router();
  router.use('/days/:date', (request, response, next) => {
    const date = request.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || date > todayDate(clock)) {
      response.status(400).json({ message: 'Choose today or a valid past date.' }); return;
    }
    next();
  });
  router.get('/days/:date', async (request, response) => {
    response.json(await readDay(pool, request.params.date));
  });
  router.put('/days/:date', async (request, response) => {
    const body = request.body;
    if (!body || typeof body.reflection !== 'string' || Object.keys(body).some(key => key !== 'reflection')) {
      response.status(400).json({ message: 'Enter reflection text.' }); return;
    }
    if (body.reflection.trim()) {
      await pool.query(`INSERT INTO planner.days (date, reflection) VALUES ($1, $2)
        ON CONFLICT (date) DO UPDATE SET reflection = EXCLUDED.reflection`, [request.params.date, body.reflection]);
    } else {
      // Empty Days are absent; dismissed prompts keep their flag when text is cleared.
      await pool.query(`WITH removed AS (
        DELETE FROM planner.days WHERE date = $1 AND NOT reflection_prompt_dismissed
      ) UPDATE planner.days SET reflection = '' WHERE date = $1 AND reflection_prompt_dismissed`, [request.params.date]);
    }
    response.json(await readDay(pool, request.params.date));
  });
  router.post('/days/:date/dismiss-prompt', async (request, response) => {
    await pool.query(`INSERT INTO planner.days (date, reflection_prompt_dismissed) VALUES ($1, true)
      ON CONFLICT (date) DO UPDATE SET reflection_prompt_dismissed = true`, [request.params.date]);
    response.json(await readDay(pool, request.params.date));
  });
  return router;
}
