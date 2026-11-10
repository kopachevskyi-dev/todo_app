import { systemClock } from '../shared/clock';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export function useRollover() {
  const client = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      const now = systemClock.now();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    const refresh = () => {
      void client.invalidateQueries();
      arm();
    };
    arm();
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [client]);
}
