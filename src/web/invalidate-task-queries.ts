import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

export async function invalidateTaskQueries(
  client: QueryClient,
  taskIds?: readonly string[],
) {
  await Promise.all(
    [
      queryKeys.backlog,
      queryKeys.today,
      queryKeys.upcoming,
      queryKeys.history,
      queryKeys.search,
      queryKeys.dayLoad,
      queryKeys.counts,
      // List changes can affect the details of any cached task.
      ...(taskIds ? taskIds.map(queryKeys.taskDetail) : [queryKeys.task]),
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
