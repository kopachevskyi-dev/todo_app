import { systemClock } from '../shared/clock';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localDate } from '../domain/time';
import type { api } from './api';
import { browserTimeZone } from './dates';
import { queryKeys } from './query-keys';
export function useRollover() {
  const client = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const arm = () => {
      clearTimeout(timer);
      const now = systemClock.now();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      // Leave a little room for a server clock that trails the browser.
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 5_000);
    };
    const refresh = async () => {
      clearTimeout(retryTimer);
      arm();
      const today = localDate(systemClock.now(), browserTimeZone());
      await client.invalidateQueries();
      const behind = client
        .getQueryCache()
        .findAll({ queryKey: queryKeys.today, type: 'active' })
        .some((query) => {
          const data = query.state.data as
            Awaited<ReturnType<typeof api.today>> | undefined;
          return data && data.day < today;
        });
      if (!disposed && behind)
        retryTimer = setTimeout(() => {
          void client.invalidateQueries();
        }, 3_000);
    };
    arm();
    window.addEventListener('focus', refresh);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      window.removeEventListener('focus', refresh);
    };
  }, [client]);
}
