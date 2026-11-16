import { useState } from 'react';
import type { List } from '../shared/contract';
import { Button, Icon } from './components';
import { useCreateTask, type CaptureDraft } from './useCreateTask';

export function QuickAddWidget({
  target = 'today',
  list,
  today,
  filteredIds,
}: {
  target?: 'today' | 'backlog';
  list?: List;
  today?: string;
  filteredIds: string[];
}) {
  const [draft, setDraft] = useState<CaptureDraft>({ title: '' });
  const { title, setTitle, error, setError, input, mutation, submit } =
    useCreateTask({
      target,
      list,
      today,
      filteredIds,
      draft,
      onDraftChange: setDraft,
    });
  return (
    <form
      className="quick-add quick-add-widget"
      aria-label="Quick add"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="quick-widget-field">
        <input
          ref={input}
          aria-label="Task title"
          aria-invalid={Boolean(error)}
          placeholder={`Add to ${target}…`}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setError(undefined);
          }}
        />
        <Button
          type="submit"
          aria-label="Add task"
          disabled={mutation.isPending}
        >
          <Icon name="plus" size={16} />
        </Button>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
