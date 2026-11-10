import { QuickAdd } from './components';
import { useCreateTask } from './useCreateTask';
export function Capture({
  target,
  mobile = false,
  list,
  onAdded,
}: {
  target: 'backlog' | 'today';
  mobile?: boolean;
  list?: import('../shared/contract').List;
  onAdded?: () => void;
}) {
  const { title, setTitle, error, setError, input, mutation, submit } =
    useCreateTask({ target, list, onAdded });
  return (
    <QuickAdd
      value={title}
      onChange={(value) => {
        setTitle(value);
        setError(undefined);
      }}
      onSubmit={submit}
      inputRef={input}
      error={error}
      pending={mutation.isPending}
      mobile={mobile}
      target={target}
    />
  );
}
