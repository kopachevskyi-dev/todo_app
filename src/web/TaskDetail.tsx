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
import { DayPicker } from './DayPicker';
import { Subtasks } from './Subtasks';
import { formatDay, planButtonLabel } from '../domain/day-picker';
import { localDate } from '../domain/time';
import { completionTime, useCompletion } from './useCompletion';
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
  history = false,
}: {
  history?: boolean;
  detail: Detail;
  onClose: () => void;
  mobile: boolean;
}) {
  const { task } = detail;
  const completion = useCompletion();
  const client = useQueryClient();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [error, setError] = useState<string>();
  const clock = useQuery({ queryKey: ['clock'], queryFn: api.clock });
  const [choosingDay, setChoosingDay] = useState(false);
  const [chosenDay, setChosenDay] = useState<string | null | undefined>(
    undefined,
  );
  const [planning, setPlanning] = useState(false);
  const dayAnchor = useRef<HTMLButtonElement>(null);
  const day = chosenDay === undefined ? task.day : chosenDay;
  const dismissDay = () => {
    setChoosingDay(false);
    setChosenDay(undefined);
  };
  const plan = async (target: string | null) => {
    if (planning) return;
    setPlanning(true);
    flushDescription();
    await queue.current;
    try {
      const result = await api.planTask(task.id, target);
      client.setQueryData<Detail>(['task', task.id], (value) =>
        value ? { ...value, task: result.task } : value,
      );
      if (
        target &&
        !task.day &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const row = document.querySelector<HTMLElement>(
          `[data-layout-id="${task.id}"]`,
        );
        if (row)
          await row
            .animate(
              [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'translateX(12px)' },
              ],
              { duration: 140, easing: 'ease-out' },
            )
            .finished.catch(() => undefined);
      }
      setChosenDay(undefined);
      setError(undefined);
      await Promise.all(
        [
          'task',
          'backlog',
          'today',
          'counts',
          'search',
          'day-load',
          'history',
        ].map((key) =>
          client.invalidateQueries({
            queryKey: key === 'task' ? [key, task.id] : [key],
          }),
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not plan the task. Try again.',
      );
    } finally {
      setPlanning(false);
    }
  };
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
        client.invalidateQueries({ queryKey: ['today'] }),
        client.invalidateQueries({ queryKey: ['search'] }),
        client.invalidateQueries({ queryKey: ['history'] }),
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
      void client.invalidateQueries({ queryKey: ['today'] });
      void client.invalidateQueries({ queryKey: ['search'] });
      void client.invalidateQueries({ queryKey: ['history'] });
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
      {task.completedAt && (
        <div className="status-pill">
          <Icon name="check" size={14} />
          {history
            ? `Completed ${formatActivityTimestamp(task.completedAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}`
            : `Completed at ${completionTime(task.completedAt)}`}
        </div>
      )}
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
          <button
            ref={dayAnchor}
            type="button"
            className={`field-value ${!day ? 'empty-value' : ''}`}
            aria-label={`Day ${day ? formatDay(day) : 'No day'}`}
            aria-expanded={choosingDay}
            disabled={Boolean(task.completedAt)}
            onClick={() => setChoosingDay(true)}
          >
            <Icon name="today" size={18} />
            {day ? formatDay(day) : 'No day'}
          </button>
        </div>
      </div>
      <Subtasks taskId={task.id} subtasks={detail.subtasks} />
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
      {clock.isError && (
        <p role="alert">
          Could not load the current day. Reopen the task to try again.
        </p>
      )}
      {completion.isError && (
        <p role="alert" className="field-error">
          {completion.error.message}
        </p>
      )}
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
        {!task.completedAt && (
          <Button
            className="plan-action"
            variant={
              task.day && chosenDay === undefined ? 'outline' : 'primary'
            }
            disabled={planning || !clock.data}
            onClick={() => {
              if (task.day && chosenDay === undefined) void plan(null);
              else if (day === null && !task.day) setChoosingDay(true);
              else void plan(day);
            }}
          >
            {task.day && chosenDay === undefined
              ? 'Move to backlog'
              : task.day && day === null
                ? 'Save'
                : clock.data
                  ? planButtonLabel(
                      day,
                      localDate(
                        new Date(clock.data.now),
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                      ),
                    )
                  : 'Choose a day'}
          </Button>
        )}
        {task.completedAt && (
          <Button
            variant="strong"
            className="reopen-button"
            disabled={completion.isPending || deleting || planning}
            onClick={() => {
              flushDescription();
              if (history) {
                setPlanning(true);
                void queue.current.then(async () => {
                  try {
                    await api.moveToBacklog(task.id);
                    await Promise.all(
                      [
                        'history',
                        'backlog',
                        'today',
                        'counts',
                        'task',
                        'search',
                        'day-load',
                      ].map((key) =>
                        client.invalidateQueries({ queryKey: [key] }),
                      ),
                    );
                    setError(undefined);
                    onClose();
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : 'Could not move the task. Try again.',
                    );
                  } finally {
                    setPlanning(false);
                  }
                });
              } else {
                void queue.current.then(() =>
                  completion.mutate({ id: task.id, completed: false }),
                );
              }
            }}
          >
            {history ? 'Move to backlog' : 'Reopen'}
          </Button>
        )}
      </footer>
      {choosingDay &&
        (mobile ? (
          <BottomSheet label="Choose a day" onClose={dismissDay}>
            <h3>Choose a day</h3>
            {clock.data ? (
              <DayPicker
                now={new Date(clock.data.now)}
                selected={day}
                onChoose={(value) => {
                  setChosenDay(value);
                  setChoosingDay(false);
                }}
              />
            ) : (
              <p role="status">Loading days…</p>
            )}
          </BottomSheet>
        ) : (
          <Popover anchor={dayAnchor} label="Choose a day" onClose={dismissDay}>
            {clock.data ? (
              <DayPicker
                now={new Date(clock.data.now)}
                selected={day}
                onChoose={(value) => {
                  setChosenDay(value);
                  setChoosingDay(false);
                }}
              />
            ) : (
              <p role="status">Loading days…</p>
            )}
          </Popover>
        ))}
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
