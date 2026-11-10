import { queryKeys } from './query-keys';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { TaskDetail } from './TaskDetail';
import { EmptyPanel, Icon } from './components';
export function Detail({
  id,
  onClose,
  mobile,
  history = false,
}: {
  history?: boolean;
  id?: string;
  onClose: () => void;
  mobile: boolean;
}) {
  const task = useQuery({
    queryKey: queryKeys.taskDetail(id),
    queryFn: () => api.task(id!),
    enabled: Boolean(id),
  });
  if (!id) return <EmptyPanel>Select a task to add details</EmptyPanel>;
  if (task.isError)
    return (
      <p role="alert" className="field-error">
        <Icon name="error" size={16} />
        {task.error.message}
      </p>
    );
  return task.data ? (
    <TaskDetail
      key={id}
      detail={task.data}
      onClose={onClose}
      mobile={mobile}
      history={history}
    />
  ) : (
    <p role="status">Loading task…</p>
  );
}
