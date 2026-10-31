import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(817421)');
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = new URL('../migrations/', import.meta.url);
    for (const version of (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      const applied = await client.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(version, directory), 'utf8'));
      await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
