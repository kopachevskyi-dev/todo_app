import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { List } from '../shared/contract';
import { api } from './api';
import { queryKeys } from './query-keys';
import { invalidateTaskQueries } from './invalidate-task-queries';
import { BottomSheet, Button, ConfirmDialog, Icon, Modal } from './components';
import { ListForm } from './ListForm';

export function ListPicker({
  lists,
  selected,
  mobile,
  loadError,
  onChoose,
  onDeleted,
  onClose,
}: {
  lists: List[];
  selected: string | null;
  mobile: boolean;
  loadError: boolean;
  onChoose: (id: string | null) => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<List | 'new'>();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.lists }),
        invalidateTaskQueries(client),
      ]);
    },
  });
  const perform = async (action: () => Promise<unknown>, done: () => void) => {
    if (mutation.isPending) return;
    try {
      await mutation.mutateAsync(action);
      done();
    } catch {
      // Keep the form open with the error so the action can be retried.
    }
  };
  const startEditing = (list: List | 'new') => {
    mutation.reset();
    setEditing(list);
  };
  if (confirming && editing && editing !== 'new') {
    return (
      <ConfirmDialog
        title={`Delete list "${editing.name}"? Its tasks stay, without a list.`}
        confirmLabel="Delete"
        onClose={() => {
          if (!mutation.isPending) {
            mutation.reset();
            setConfirming(false);
          }
        }}
        onConfirm={() => {
          void perform(
            () => api.deleteList(editing.id),
            () => {
              onClose();
              onDeleted();
            },
          );
        }}
      >
        {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      </ConfirmDialog>
    );
  }
  if (editing) {
    return (
      <ListForm
        list={editing === 'new' ? undefined : editing}
        lists={lists}
        mobile={mobile}
        pending={mutation.isPending}
        error={mutation.isError ? mutation.error.message : undefined}
        onClose={() => {
          if (!mutation.isPending) setEditing(undefined);
        }}
        onDelete={editing === 'new' ? undefined : () => setConfirming(true)}
        onSave={(values) => {
          void perform(async () => {
            if (editing === 'new') {
              const { list } = await api.createList(values);
              onChoose(list.id);
            } else {
              await api.patchList(editing.id, values);
            }
          }, onClose);
        }}
      />
    );
  }
  const Container = mobile ? BottomSheet : Modal;
  return (
    <Container label="Choose a list" className="list-dialog" onClose={onClose}>
      <h3>Choose a list</h3>
      <div className="list-options">
        {lists.map((list) => (
          <div className="list-option-row" key={list.id}>
            <button
              className="list-option"
              aria-pressed={selected === list.id}
              onClick={() => {
                onChoose(list.id);
                onClose();
              }}
            >
              <span className="list-dot" style={{ background: list.color }} />
              <span className="list-option-name">{list.name}</span>
              {selected === list.id && <Icon name="check" size={16} />}
            </button>
            <Button
              variant="ghost"
              aria-label={`Edit ${list.name}`}
              onClick={() => startEditing(list)}
            >
              Edit
            </Button>
          </div>
        ))}
        <button
          className="list-option"
          aria-pressed={selected === null}
          onClick={() => {
            onChoose(null);
            onClose();
          }}
        >
          <span className="list-option-name">No list</span>
          {selected === null && <Icon name="check" size={16} />}
        </button>
        <Button variant="ghost" onClick={() => startEditing('new')}>
          <Icon name="plus" size={16} />
          New list
        </Button>
        {loadError && <p role="alert">Could not load lists.</p>}
      </div>
    </Container>
  );
}
