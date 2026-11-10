import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { api } from './api';
export function useBacklogPicker() {
  const [planning, setPlanning] = useState(false);
  const client = useQueryClient();
  const [plannedSelection, setPlannedSelection] = useState<string[]>([]);
  const pickerBacklog = useQuery({
    queryKey: queryKeys.backlogPicker,
    queryFn: () => api.backlog(),
    enabled: planning,
  });
  const planToday = useMutation({
    mutationFn: api.planToday,
    onSuccess: () => {
      setPlanning(false);
      setPlannedSelection([]);

      void client.invalidateQueries({ queryKey: queryKeys.today });
      void client.invalidateQueries({ queryKey: queryKeys.backlog });
      void client.invalidateQueries({ queryKey: queryKeys.counts });
    },
  });
  const closePlanner = () => {
    setPlanning(false);
    setPlannedSelection([]);
  };
  const openPlanner = () => {
    setPlannedSelection([]);
    setPlanning(true);
  };
  return {
    planning,
    pickerBacklog,
    plannedSelection,
    setPlannedSelection,
    planToday,
    closePlanner,
    openPlanner,
  };
}
