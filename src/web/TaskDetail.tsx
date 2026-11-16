import { usePlanTask } from './usePlanTask';
import { useEscape } from './useEscape';
import { browserTimeZone } from './dates';
import { today } from './useToday';
import { queryKeys } from './query-keys';
import { TaskDetailFooter } from './TaskDetailFooter';
import { TaskActivity } from './TaskActivity';
import { useDeleteTask } from './useDeleteTask';
import { useTaskEditor } from './useTaskEditor';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListPicker } from './ListPicker';
import type { TaskDetailData } from './task-detail-types';
import { formatActivityTimestamp } from './dates';
import { api } from './api';
import { DayPickerDialog } from './DayPicker';
import { Subtasks } from './Subtasks';
import { formatDay } from '../domain/day-picker';
import { completionTime } from './dates';
import { useCompletion } from './useCompletion';
import { Button, ConfirmDialog, Checkbox, Icon, Popover } from './components';

export function TaskDetail({
  detail,
  onClose,
  mobile,
  history = false,
}: {
  history?: boolean;
  detail: TaskDetailData;
  onClose: () => void;
  mobile: boolean;
}) {
  const { task } = detail;
  const completion = useCompletion();
  const lists = useQuery({ queryKey: queryKeys.lists, queryFn: api.lists });
  const [error, setError] = useState<string>();
  const [choosingDay, setChoosingDay] = useState(false);
  const [planning, setPlanning] = useState(false);
  const day = task.day;
  const currentDay = today();
  const dayLabel =
    day === currentDay ? 'Today' : day ? formatDay(day) : 'No day';
  const dismissDay = () => {
    setChoosingDay(false);
  };
  const [choosingList, setChoosingList] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreAnchor = useRef<HTMLButtonElement>(null);

  const anchor = useRef<HTMLButtonElement>(null);
  const {
    title,
    setTitle,
    description,
    changeDescription,
    cancelTitle,
    saveTitle,
    save,
    queue,
    flushDescription,
  } = useTaskEditor(task, lists, setError);
  const { deleting, remove } = useDeleteTask(
    task,
    queue,
    onClose,
    setConfirming,
    setError,
  );
  const titleInput = useRef<HTMLTextAreaElement>(null);
  useEscape(() => {
    if (document.activeElement !== titleInput.current) return false;
    cancelTitle();
    titleInput.current?.blur();
  }, 30);
  const { plan, failedTarget } = usePlanTask(
    task,
    setPlanning,
    setError,
    flushDescription,
    queue,
  );
  const selectedList = lists.data?.lists.find(
    (list) => list.id === task.listId,
  );
  return (
    <div className="task-detail">
      <div className="detail-title-row">
        <Checkbox
          label={`${task.completedAt ? 'Reopen' : 'Complete'} "${task.title}"`}
          checked={Boolean(task.completedAt)}
          disabled={completion.isPending || deleting || planning}
          onChange={async () => {
            flushDescription();
            await queue.current;
            await completion.mutateAsync({
              id: task.id,
              completed: !task.completedAt,
            });
          }}
        />
        <textarea
          ref={titleInput}
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
        <Button
          ref={moreAnchor}
          variant="ghost"
          aria-label="More task actions"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          ⋯
        </Button>
      </div>
      {moreOpen && (
        <Popover
          anchor={moreAnchor}
          label="Task actions"
          onClose={() => setMoreOpen(false)}
        >
          <div role="menu" aria-label="Task actions">
            <Button
              autoFocus
              role="menuitem"
              variant="ghost"
              disabled={deleting}
              onClick={() => {
                setMoreOpen(false);
                flushDescription();
                setConfirming(true);
              }}
            >
              Delete
            </Button>
          </div>
        </Popover>
      )}
      {task.completedAt && (
        <div className="status-pill">
          <Icon name="check" size={14} />
          {history
            ? `Completed ${formatActivityTimestamp(task.completedAt, browserTimeZone())}`
            : `Completed at ${completionTime(task.completedAt)}`}
        </div>
      )}
      <textarea
        className="detail-description"
        aria-label="Description"
        placeholder="Add a description"
        value={description}
        onChange={(event) => changeDescription(event.target.value)}
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
            type="button"
            className={`field-value ${!day ? 'empty-value' : ''}`}
            aria-label={`Day ${planning ? 'Saving…' : dayLabel}`}
            aria-busy={planning}
            aria-expanded={choosingDay}
            disabled={Boolean(task.completedAt) || planning || deleting}
            onClick={() => setChoosingDay(true)}
          >
            <Icon name="today" size={18} />
            {planning ? 'Saving…' : dayLabel}
          </button>
        </div>
      </div>
      <Subtasks taskId={task.id} subtasks={detail.subtasks} />
      <TaskActivity detail={detail} />
      {completion.isError && (
        <p role="alert" className="field-error">
          {completion.error.message}
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
          {failedTarget !== undefined && (
            <Button
              variant="ghost"
              disabled={planning}
              onClick={() => void plan(failedTarget)}
            >
              Retry
            </Button>
          )}
        </p>
      )}
      <TaskDetailFooter
        task={task}
        deleting={deleting}
        flushDescription={flushDescription}
        planning={planning}
        history={history}
        setPlanning={setPlanning}
        queue={queue}
        setError={setError}
        onClose={onClose}
        completion={completion}
      />
      {choosingDay && (
        <DayPickerDialog
          mobile={mobile}
          onClose={dismissDay}
          now={new Date()}
          selected={day}
          onChoose={(value) => {
            setChoosingDay(false);
            void plan(value);
          }}
        />
      )}
      {choosingList && (
        <ListPicker
          lists={lists.data?.lists ?? []}
          loadError={lists.isError}
          selected={task.listId}
          mobile={mobile}
          onChoose={(listId) => save({ listId })}
          onDeleted={onClose}
          onClose={() => setChoosingList(false)}
        />
      )}
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
