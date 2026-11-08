import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  Counts,
  PatchTaskRequest,
  TaskRow,
  taskDetailResponseSchema,
} from '../shared/contract';
import { formatActivityTimestamp } from '../domain/activity';
import { api } from './api';
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  Icon,
  Popover,
} from './components';

type Detail = z.infer<typeof taskDetailResponseSchema>;

export function TaskDetail({
  detail,
  onClose,
  mobile,
}: {
  detail: Detail;
  onClose: () => void;
  mobile: boolean;
}) {
  const { task } = detail;
  const client = useQueryClient();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [error, setError] = useState<string>();
  const [choosingList, setChoosingList] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDescription = useRef<string | undefined>(undefined);
  const savedTitle = useRef(task.title);
  const queue = useRef(Promise.resolve());

  const save = (input: PatchTaskRequest) => {
    queue.current = queue.current.then(async () => {
      await Promise.all([
        client.cancelQueries({ queryKey: ['task', task.id] }),
        client.cancelQueries({ queryKey: ['backlog'] }),
      ]);
      const previous = client.getQueryData<Detail>(['task', task.id]);
      const rows = client.getQueriesData<{ tasks: TaskRow[] }>({
        queryKey: ['backlog'],
      });
      client.setQueryData<Detail>(['task', task.id], (value) =>
        value ? { ...value, task: { ...value.task, ...input } } : value,
      );
      for (const [key, value] of rows) {
        client.setQueryData(
          key,
          value && {
            tasks: value.tasks.flatMap((row) => {
              if (row.id !== task.id) return [row];
              const updated = {
                ...row,
                ...input,
                list:
                  input.listId === undefined
                    ? row.list
                    : (lists.data?.lists.find(
                        (list) => list.id === input.listId,
                      ) ?? null),
              };
              return key[1] && updated.listId !== key[1] ? [] : [updated];
            }),
          },
        );
      }
      try {
        const result = await api.patchTask(task.id, input);
        if (input.title !== undefined) savedTitle.current = result.task.title;
        client.setQueryData<Detail>(['task', task.id], (value) =>
          value ? { ...value, task: result.task } : value,
        );
        setError(undefined);
      } catch (failure) {
        client.setQueryData(['task', task.id], previous);
        for (const [key, value] of rows) client.setQueryData(key, value);
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not save the task. Try again.',
        );
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['task', task.id] }),
        client.invalidateQueries({ queryKey: ['backlog'] }),
      ]);
    });
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const flushDescription = () => {
    clearTimeout(timer.current);
    const value = pendingDescription.current;
    pendingDescription.current = undefined;
    if (value !== undefined) saveRef.current({ description: value });
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pendingDescription.current !== undefined)
        saveRef.current({ description: pendingDescription.current });
      pendingDescription.current = undefined;
    },
    [],
  );
  const saveTitle = () => {
    const value = title.trim();
    if (!value) {
      setTitle(savedTitle.current);
      return;
    }
    setTitle(value);
    if (value !== savedTitle.current) save({ title: value });
  };
  const selectedList = lists.data?.lists.find(
    (list) => list.id === task.listId,
  );
  const listOptions = (
    <div className="list-options">
      <Button
        variant="ghost"
        onClick={() => {
          save({ listId: null });
          setChoosingList(false);
        }}
      >
        No list
      </Button>
      {lists.data?.lists.map((list) => (
        <Button
          key={list.id}
          variant="ghost"
          onClick={() => {
            save({ listId: list.id });
            setChoosingList(false);
          }}
        >
          <span className="list-dot" style={{ background: list.color }} />
          {list.name}
        </Button>
      ))}
      {lists.isError && <p role="alert">Could not load lists.</p>}
    </div>
  );
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    await queue.current;
    await Promise.all([
      client.cancelQueries({ queryKey: ['backlog'] }),
      client.cancelQueries({ queryKey: ['counts'] }),
    ]);
    const rows = client.getQueriesData<{ tasks: TaskRow[] }>({
      queryKey: ['backlog'],
    });
    const counts = client.getQueryData<Counts>(['counts']);
    for (const [key, value] of rows)
      client.setQueryData(
        key,
        value && { tasks: value.tasks.filter((row) => row.id !== task.id) },
      );
    if (counts && !task.day && !task.completedAt)
      client.setQueryData(['counts'], {
        ...counts,
        backlog: counts.backlog - 1,
      });
    try {
      await api.deleteTask(task.id);
      setConfirming(false);
      onClose();
    } catch (failure) {
      for (const [key, value] of rows) client.setQueryData(key, value);
      if (counts) client.setQueryData(['counts'], counts);
      setConfirming(false);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not delete the task. Try again.',
      );
    } finally {
      setDeleting(false);
      void client.invalidateQueries({ queryKey: ['backlog'] });
      void client.invalidateQueries({ queryKey: ['counts'] });
    }
  };
  return (
    <div className="task-detail">
      <textarea
        rows={1}
        className="detail-title"
        aria-label="Title"
        maxLength={200}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <textarea
        className="detail-description"
        aria-label="Description"
        placeholder="Add a description"
        value={description}
        onChange={(event) => {
          const value = event.target.value;
          setDescription(value);
          pendingDescription.current = value;
          clearTimeout(timer.current);
          timer.current = setTimeout(flushDescription, 500);
        }}
        onBlur={flushDescription}
      />
      <div className="detail-fields">
        <div className="field-row">
          <span>List</span>
          <button
            ref={anchor}
            type="button"
            className={`field-value ${!selectedList ? 'empty-value' : ''}`}
            aria-label={`List ${selectedList?.name ?? 'No list'}`}
            aria-expanded={choosingList}
            onClick={() => setChoosingList(true)}
          >
            {selectedList && (
              <span
                className="list-dot"
                style={{ background: selectedList.color }}
              />
            )}
            {selectedList?.name ?? 'No list'}
          </button>
        </div>
        <div className="field-row">
          <span>Day</span>
          <span className={`field-value ${!task.day ? 'empty-value' : ''}`}>
            <Icon name="today" size={18} />
            {task.day
              ? new Intl.DateTimeFormat('en-US', {
                  timeZone: 'UTC',
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }).format(new Date(`${task.day}T12:00:00Z`))
              : 'No day'}
          </span>
        </div>
      </div>
      <h3>Subtasks</h3>
      <section className="activity">
        <h3>Activity</h3>
        <ul>
          {detail.activity.map((item, index) => (
            <li
              key={`${item.at}-${index}`}
              className={item.type === 'completed' ? 'completed-event' : ''}
            >
              <span aria-hidden="true" className="activity-dot" />
              <span>
                {formatActivityTimestamp(
                  item.at,
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                )}{' '}
                — <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <footer className="detail-footer">
        <Button
          variant={mobile ? 'icon' : 'outline'}
          aria-label={mobile ? 'Delete task' : undefined}
          disabled={deleting}
          onClick={() => {
            flushDescription();
            setConfirming(true);
          }}
        >
          {mobile ? <Icon name="trash" /> : 'Delete'}
        </Button>
      </footer>
      {choosingList &&
        (mobile ? (
          <BottomSheet
            label="Choose a list"
            onClose={() => setChoosingList(false)}
          >
            <h3>Choose a list</h3>
            {listOptions}
          </BottomSheet>
        ) : (
          <Popover
            anchor={anchor}
            label="Choose a list"
            onClose={() => setChoosingList(false)}
          >
            {listOptions}
          </Popover>
        ))}
      {confirming && (
        <ConfirmDialog
          title="Delete task"
          confirmLabel="Delete"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            void remove();
          }}
        >
          Delete this task? This can't be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
