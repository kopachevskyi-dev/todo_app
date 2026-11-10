import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listPalette, type List } from '../shared/contract';
import { api } from './api';
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  Icon,
  Popover,
  SectionLabel,
} from './components';

export function Lists({
  lists,
  active,
  onFilter,
  mobile,
}: {
  lists: List[];
  active?: string;
  onFilter: (id?: string) => void;
  mobile: boolean;
}) {
  const client = useQueryClient();
  const anchor = useRef<HTMLButtonElement | null>(null);
  const [menu, setMenu] = useState<List>();
  const [colors, setColors] = useState(false);
  const [editing, setEditing] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<List>();
  useEffect(() => {
    if (editing) nameInput.current?.focus();
  }, [editing]);
  const closeMenu = useCallback(() => setMenu(undefined), []);
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await client.invalidateQueries();
    },
  });
  const perform = async (action: () => Promise<unknown>, done: () => void) => {
    if (mutation.isPending) return;
    try {
      await mutation.mutateAsync(action);
      done();
    } catch {
      /* Inline error below. */
    }
  };
  const startEditing = (list?: List) => {
    mutation.reset();
    setName(list?.name ?? '');
    setEditing(list?.id ?? 'new');
    closeMenu();
  };
  const input = (
    <form
      className="list-name-form"
      onSubmit={(event) => {
        event.preventDefault();
        void perform(
          () =>
            editing === 'new'
              ? api.createList({ name })
              : api.patchList(editing!, { name }),
          () => setEditing(undefined),
        );
      }}
    >
      <input
        autoFocus
        ref={nameInput}
        aria-label={editing === 'new' ? 'New list name' : 'Rename list name'}
        aria-invalid={mutation.isError}
        value={name}
        maxLength={40}
        required
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setEditing(undefined);
            mutation.reset();
          }
        }}
      />
      <Button variant="ghost" type="submit" disabled={mutation.isPending}>
        Save
      </Button>
      <Button
        variant="icon"
        aria-label="Cancel list name"
        onClick={() => {
          setEditing(undefined);
          mutation.reset();
        }}
      >
        <Icon name="close" size={16} />
      </Button>
    </form>
  );
  const menuContent = menu && (
    <>
      <h3 className="sheet-label">{menu.name}</h3>
      {colors ? (
        <div className="list-options">
          {listPalette.map(({ hex: color, name }) => (
            <Button
              key={color}
              variant="ghost"
              aria-label={name}
              aria-pressed={menu.color === color}
              disabled={mutation.isPending}
              onClick={() => {
                void perform(
                  () => api.patchList(menu.id, { color }),
                  closeMenu,
                );
              }}
            >
              <span className="list-dot" style={{ background: color }} />
              {name}
              {menu.color === color && <Icon name="check" size={16} />}
            </Button>
          ))}
        </div>
      ) : (
        <div
          role="menu"
          aria-label={`${menu.name} options`}
          className="list-options"
          onKeyDown={(event) => {
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ),
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              buttons[
                (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
                  buttons.length
              ]?.focus();
            }
          }}
        >
          <Button
            variant="ghost"
            role="menuitem"
            onClick={() => startEditing(menu)}
          >
            Rename
          </Button>
          <Button
            variant="ghost"
            role="menuitem"
            onClick={() => setColors(true)}
          >
            Color
          </Button>
          <Button
            variant="ghost"
            role="menuitem"
            onClick={() => {
              setDeleting(menu);
              closeMenu();
            }}
          >
            Delete
          </Button>
        </div>
      )}
      {mutation.isError && (
        <p className="field-error" role="alert">
          {mutation.error.message}
        </p>
      )}
    </>
  );
  return (
    <>
      <nav aria-label="Lists" className={mobile ? 'list-chips' : 'lists'}>
        {!mobile && <SectionLabel>Lists</SectionLabel>}
        {mobile && (
          <button
            className="list-link"
            aria-pressed={!active}
            onClick={() => onFilter()}
          >
            All
          </button>
        )}
        {lists.map((list) =>
          editing === list.id ? (
            <div key={list.id}>{input}</div>
          ) : (
            <div className="list-control" key={list.id}>
              <button
                className="list-link"
                aria-pressed={active === list.id}
                onClick={() =>
                  onFilter(active === list.id ? undefined : list.id)
                }
              >
                <span className="list-dot" style={{ background: list.color }} />
                {list.name}
              </button>
              <Button
                variant="icon"
                className="list-menu-trigger"
                aria-label={`${list.name} options`}
                aria-haspopup="menu"
                aria-expanded={menu?.id === list.id}
                onClick={(event) => {
                  anchor.current = event.currentTarget;
                  mutation.reset();
                  setColors(false);
                  setMenu(list);
                }}
              >
                …
              </Button>
            </div>
          ),
        )}
        {editing === 'new' ? (
          input
        ) : (
          <button className="new-list" onClick={() => startEditing()}>
            <Icon name="plus" size={14} />
            New list
          </button>
        )}
        {editing && mutation.isError && (
          <p className="field-error" role="alert">
            {mutation.error.message}
          </p>
        )}
      </nav>
      {menu &&
        (mobile ? (
          <BottomSheet label={`${menu.name} options`} onClose={closeMenu}>
            {menuContent}
          </BottomSheet>
        ) : (
          <Popover
            anchor={anchor}
            label={`${menu.name} options`}
            onClose={closeMenu}
          >
            {menuContent}
          </Popover>
        ))}
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
                if (active === deleting.id) onFilter();
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
