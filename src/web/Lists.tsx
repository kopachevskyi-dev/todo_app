import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type List } from '../shared/contract';
import { api } from './api';
import { queryKeys } from './query-keys';
import { invalidateTaskQueries } from './invalidate-task-queries';
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  Icon,
  Modal,
  SectionLabel,
} from './components';
import { ListForm } from './ListForm';

export function Lists({
  lists,
  active,
  onFilter,
  mobile,
}: {
  lists: List[];
  active: string[];
  onFilter: (id?: string) => void;
  mobile: boolean;
}) {
  const client = useQueryClient();
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<List | 'new'>();
  const [deleting, setDeleting] = useState<List>();
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
      /* Keep the form and show the error for retry. */
    }
  };
  const startEditing = (list?: List) => {
    mutation.reset();
    setEditing(list ?? 'new');
  };
  const Container = mobile ? BottomSheet : Modal;
  return (
    <>
      <nav aria-label="Lists" className={mobile ? 'list-chips' : 'lists'}>
        {!mobile && <SectionLabel>Lists</SectionLabel>}
        {lists.map((list) => (
          <div className="list-control" key={list.id}>
            <button
              className="list-link"
              aria-pressed={active.includes(list.id)}
              onClick={() => onFilter(list.id)}
            >
              <span className="list-dot" style={{ background: list.color }} />
              {list.name}
            </button>
          </div>
        ))}
      </nav>
      <div className="list-management-actions">
        <button className="new-list" onClick={() => startEditing()}>
          <Icon name="plus" size={14} />
          New list
        </button>
        <Button
          variant="ghost"
          onClick={() => {
            mutation.reset();
            setManaging(true);
          }}
        >
          Manage lists
        </Button>
      </div>
      {managing && (
        <Container
          label="Manage lists"
          className="list-dialog"
          onClose={() => {
            if (editing || deleting) return false;
            setManaging(false);
          }}
        >
          <h3>Manage lists</h3>
          <Button variant="outline" onClick={() => startEditing()}>
            New list
          </Button>
          <div className="managed-lists">
            {lists.map((list) => (
              <div className="managed-list" key={list.id}>
                <span className="managed-list-name">
                  <span
                    className="list-dot"
                    style={{ background: list.color }}
                  />
                  {list.name}
                </span>
                <Button
                  variant="ghost"
                  aria-label={`Edit ${list.name}`}
                  onClick={() => startEditing(list)}
                >
                  Edit
                </Button>
                <Button
                  variant="icon"
                  aria-label={`Delete ${list.name}`}
                  onClick={() => {
                    mutation.reset();
                    setDeleting(list);
                  }}
                >
                  <Icon name="trash" />
                </Button>
              </div>
            ))}
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setManaging(false)}>
              Close
            </Button>
          </div>
        </Container>
      )}
      {editing && (
        <ListForm
          list={editing === 'new' ? undefined : editing}
          mobile={mobile}
          pending={mutation.isPending}
          error={mutation.isError ? mutation.error.message : undefined}
          onClose={() => {
            if (!mutation.isPending) setEditing(undefined);
          }}
          onSave={(values) => {
            void perform(
              () =>
                editing === 'new'
                  ? api.createList(values)
                  : api.patchList(editing.id, values),
              () => setEditing(undefined),
            );
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete list "${deleting.name}"? Its tasks stay, without a list.`}
          confirmLabel="Delete"
          onClose={() => {
            if (!mutation.isPending) setDeleting(undefined);
          }}
          onConfirm={() => {
            void perform(
              () => api.deleteList(deleting.id),
              () => {
                if (active.includes(deleting.id)) onFilter(deleting.id);
                setDeleting(undefined);
              },
            );
          }}
        >
          {mutation.isError && (
            <p className="field-error" role="alert">
              {mutation.error.message}
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
