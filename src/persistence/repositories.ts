import { asc } from 'drizzle-orm';
import type { AppDatabase } from './database';
import { lists } from './schema';

export function createRepositories(db: AppDatabase) {
  return {
    lists: {
      all: () =>
        db
          .select({
            id: lists.id,
            name: lists.name,
            color: lists.color,
            position: lists.position,
          })
          .from(lists)
          .orderBy(asc(lists.position))
          .all(),
    },
    transaction: <T>(
      work: (tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0]) => T,
    ) => db.transaction(work),
  };
}
