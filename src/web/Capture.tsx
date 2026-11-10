import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { BottomSheet, Button, Popover, QuickAdd } from './components';
import { useCreateTask, type CaptureDraft } from './useCreateTask';
import { api } from './api';
import { queryKeys } from './query-keys';
import { DayPicker } from './DayPicker';
import { formatDay } from '../domain/day-picker';
import type { List } from '../shared/contract';

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
  list?: List;
  onAdded?: () => void;
  draft?: CaptureDraft;
  onDraftChange?: (value: CaptureDraft) => void;
  onClose?: () => void;
}) {
  const [localDraft, setLocalDraft] = useState<CaptureDraft>({ title: '' });
  const value = draft ?? localDraft;
  const change = onDraftChange ?? setLocalDraft;
  const lists = useQuery({ queryKey: queryKeys.lists, queryFn: api.lists });
  const todayQuery = useQuery({
    queryKey: queryKeys.todayList(),
    queryFn: () => api.today(),
  });
  const today = todayQuery.data?.day;
  const { lists: filter } = useSearch({ strict: false });
  const filteredIds = filter?.split(',').filter(Boolean) ?? [];
  const selectedList =
    value.listId === undefined
      ? list
      : lists.data?.lists.find((item) => item.id === value.listId);
  const day =
    value.day === undefined ? (target === 'today' ? today : null) : value.day;
  const dayLabel =
    day === today && day ? 'Today' : day ? formatDay(day) : 'No day';
  const [picker, setPicker] = useState<'list' | 'day'>();
  const listAnchor = useRef<HTMLButtonElement>(null);
  const dayAnchor = useRef<HTMLButtonElement>(null);
  const { title, setTitle, error, setError, input, mutation, submit } =
    useCreateTask({
      target,
      list: selectedList,
      day,
      today,
      filteredIds,
      onAdded,
      draft: value,
      onDraftChange: change,
    });
  const update = (patch: Partial<CaptureDraft>) => {
    change({ ...value, listId: selectedList?.id ?? null, day, ...patch });
    setPicker(undefined);
  };
  const options =
    picker === 'list' ? (
      <div className="list-options">
        <Button variant="ghost" onClick={() => update({ listId: null })}>
          No list
        </Button>
        {lists.data?.lists.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => update({ listId: item.id })}
          >
            <span className="list-dot" style={{ background: item.color }} />
            {item.name}
          </Button>
        ))}
        {lists.isError && <p role="alert">Could not load lists.</p>}
      </div>
    ) : today ? (
      <DayPicker
        now={new Date(`${today}T12:00:00`)}
        selected={day ?? null}
        onChoose={(day) => update({ day })}
      />
    ) : (
      <p role="status">Loading days…</p>
    );
  return (
    <>
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
      >
        <div className="capture-metadata">
          <Button
            ref={listAnchor}
            variant="ghost"
            aria-label={`List ${selectedList?.name ?? 'No list'}`}
            aria-expanded={picker === 'list'}
            disabled={mutation.isPending}
            onClick={() => setPicker('list')}
          >
            List {selectedList?.name ?? 'No list'}
          </Button>
          <Button
            ref={dayAnchor}
            variant="ghost"
            aria-label={`Day ${dayLabel}`}
            aria-expanded={picker === 'day'}
            disabled={mutation.isPending || !today}
            onClick={() => setPicker('day')}
          >
            Day {dayLabel}
          </Button>
          {filteredIds.length > 1 && (
            <span className="field-hint">
              Several lists selected; starts with No list.
            </span>
          )}
        </div>
      </QuickAdd>
      {picker &&
        (mobile ? (
          <BottomSheet
            label={`Choose a ${picker}`}
            onClose={() => setPicker(undefined)}
          >
            {options}
          </BottomSheet>
        ) : (
          <Popover
            anchor={picker === 'list' ? listAnchor : dayAnchor}
            label={`Choose a ${picker}`}
            onClose={() => setPicker(undefined)}
          >
            {options}
          </Popover>
        ))}
    </>
  );
}
