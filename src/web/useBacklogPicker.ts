import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { invalidateTaskQueries } from './invalidate-task-queries';
import { api, ApiError } from './api';
export function useBacklogPicker() {
  const [planning, setPlanning] = useState(false);
  const client = useQueryClient();
  const [plannedSelection, setPlannedSelection] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [confirmation, setConfirmation] = useState<string>();
  const pickerBacklog = useQuery({
    queryKey: queryKeys.backlogPicker,
    queryFn: () => api.backlog(),
    enabled: planning,
  });
  const planToday = useMutation({
    mutationFn: api.planToday,
    onMutate: () => setError(undefined),
    onSuccess: (_result, taskIds) => {
      setPlanning(false);
      setPlannedSelection([]);
      setConfirmation(`Added ${taskIds.length} to Today`);
      return invalidateTaskQueries(client, taskIds);
    },
    onError: async (failure, taskIds) => {
      if (
        failure instanceof ApiError &&
        failure.status === 409 &&
        failure.details.code === 'not_in_backlog' &&
        failure.details.taskIds
      ) {
        const rejected = new Set(failure.details.taskIds);
        const remaining = taskIds.filter((id) => !rejected.has(id));
        setPlannedSelection(remaining);
        client.setQueryData<Awaited<ReturnType<typeof api.backlog>>>(
          queryKeys.backlogPicker,
          (data) =>
            data && {
              tasks: data.tasks.filter((task) => !rejected.has(task.id)),
            },
        );
        const count = taskIds.length - remaining.length;
        setError(
          `${count} ${count === 1 ? 'task was' : 'tasks were'} already planned elsewhere. Add the remaining ${remaining.length}?`,
        );
        await invalidateTaskQueries(client, taskIds);
      } else {
        setError("Couldn't add tasks. Try again.");
      }
    },
  });
  const closePlanner = () => {
    setPlanning(false);
    setPlannedSelection([]);
    setError(undefined);
  };
  const openPlanner = () => {
    setPlannedSelection([]);
    setError(undefined);
    setConfirmation(undefined);
    setPlanning(true);
  };
  return {
    planning,
    pickerBacklog,
    plannedSelection,
    setPlannedSelection,
    planToday,
    error,
    confirmation,
    closePlanner,
    openPlanner,
  };
}
