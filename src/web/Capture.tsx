import { QuickAdd } from './components';
import { useCreateTask } from './useCreateTask';
export function Capture({
  target,
  mobile = false,
  list,
  onAdded,
  draft,
  onDraftChange,
  onClose,
}: {
  target: 'backlog' | 'today';
  mobile?: boolean;
  list?: import('../shared/contract').List;
  onAdded?: () => void;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onClose?: () => void;
}) {
  const { title, setTitle, error, setError, input, mutation, submit } =
    useCreateTask({ target, list, onAdded, draft, onDraftChange });
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
      onClose={onClose}
    />
  );
}
