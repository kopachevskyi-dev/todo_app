import { spawn } from 'node:child_process';
import { link, mkdir, mkdtemp, open, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Clock } from './clock.js';

export async function backupDatabase({ clock, backupsDirectory, databaseUrl }: { clock: Clock; backupsDirectory: string; databaseUrl?: string }): Promise<void> {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: clock.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(clock.now());
  await mkdir(backupsDirectory, { recursive: true });
  const filename = `${date}.dump`;
  if (!(await readdir(backupsDirectory)).includes(filename)) {
    const temporary = await mkdtemp(join(backupsDirectory, '.backup-'));
    const path = join(temporary, 'database.dump');
    try {
      const file = await open(path, 'wx', 0o600);
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn('pg_dump', ['--format=custom', ...(databaseUrl ? ['--dbname', databaseUrl] : [])], {
            stdio: ['ignore', file.fd, 'pipe'],
          });
          let stderr = '';
          child.stderr!.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4096); });
          child.once('error', reject);
          child.once('close', code => code === 0 ? resolve() : reject(new Error(`pg_dump failed (${code}): ${stderr.trim()}`)));
        });
      } finally { await file.close(); }
      // Publishing a complete file atomically also preserves an existing backup
      // if two servers happen to start together.
      try { await link(path, join(backupsDirectory, filename)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }
  const backups = (await readdir(backupsDirectory)).filter(name => /^\d{4}-\d{2}-\d{2}\.dump$/.test(name)).sort().reverse();
  for (const name of backups.slice(3)) await rm(join(backupsDirectory, name));
}
