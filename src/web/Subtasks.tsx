import { queryKeys } from './query-keys';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Subtask } from '../shared/contract';
import { api } from './api';
import { Checkbox, Icon } from './components';

export function Subtasks({
  taskId,
  subtasks,
}: {
  taskId: string;
  subtasks: Subtask[];
}) {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const pending = useRef(new Set<string>());
  const addInput = useRef<HTMLInputElement>(null);

  const mutate = async (key: string, work: () => Promise<unknown>) => {
    if (pending.current.has(key)) return false;
    pending.current.add(key);
    try {
      await work();
      await Promise.all(
        [
          queryKeys.taskDetail(taskId),
          queryKeys.backlog,
          queryKeys.today,
          queryKeys.search,
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      setError(undefined);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save the subtask. Try again.',
      );
      return false;
    } finally {
      pending.current.delete(key);
    }
  };
  const add = async () => {
    if (pending.current.has('add')) return;
    const value = title.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    if (await mutate('add', () => api.createSubtask(taskId, value))) {
      setTitle('');
      addInput.current?.focus();
    }
  };
  const rename = async (subtask: Subtask) => {
    if (pending.current.has(subtask.id) || editing !== subtask.id) return;
    const value = draft.trim();
    if (!value || value === subtask.title) {
      setEditing(undefined);
      return;
    }
    if (
      await mutate(subtask.id, () =>
        api.patchSubtask(subtask.id, { title: value }),
      )
    )
      setEditing((current) => (current === subtask.id ? undefined : current));
  };

  return (
    <section className="subtasks" aria-label="Subtasks">
      <h3>Subtasks</h3>
      {subtasks.map((subtask) => (
        <div
          key={subtask.id}
          className={`subtask-row ${subtask.done ? 'subtask-done' : ''} ${editing === subtask.id ? 'editing' : ''}`}
        >
          <Checkbox
            label={subtask.title}
            checked={subtask.done}
            onChange={async () => {
              await mutate(subtask.id, () =>
                api.patchSubtask(subtask.id, { done: !subtask.done }),
              );
            }}
          />
          {editing === subtask.id ? (
            <input
              autoFocus
              aria-label={subtask.title}
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                void rename(subtask);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void rename(subtask);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setEditing(undefined);
                }
              }}
            />
          ) : (
            <button
              className="subtask-title"
              type="button"
              onClick={() => {
                setEditing(subtask.id);
                setDraft(subtask.title);
              }}
            >
              {subtask.title}
            </button>
          )}
          <button
            type="button"
            className="subtask-delete"
            aria-label="Delete subtask"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              void mutate(subtask.id, () => api.deleteSubtask(subtask.id)).then(
                (saved) => {
                  if (saved)
                    setEditing((current) =>
                      current === subtask.id ? undefined : current,
                    );
                },
              );
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="subtask-add">
          <Icon name="plus" size={16} />
          <input
            ref={addInput}
            autoFocus
            aria-label="Add subtask"
            placeholder="Add subtask"
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (!title.trim() && !pending.current.has('add'))
                setAdding(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void add();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setAdding(false);
                setTitle('');
              }
            }}
          />
        </div>
      ) : (
        <button
          className="subtask-add"
          type="button"
          onClick={() => {
            setTitle('');
            setAdding(true);
          }}
        >
          <Icon name="plus" size={16} />
          Add subtask
        </button>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
