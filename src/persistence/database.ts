import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export function openDatabase(path: string) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: resolve('migrations') });
    return { db, close: () => sqlite.close() };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export type AppDatabase = ReturnType<typeof openDatabase>['db'];
