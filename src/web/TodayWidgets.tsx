import { useState } from 'react';
import type { List, TodayResponse } from '../shared/contract';
import { Button, Icon } from './components';
import { dateLabel } from './dates';
import { progressWidget } from './progress';
import { StatWidget } from './StatWidget';
import { useBacklogPicker } from './useBacklogPicker';
import { useCreateTask, type CaptureDraft } from './useCreateTask';

function QuickAddWidget({
  list,
  today,
  filteredIds,
}: {
  list?: List;
  today?: string;
  filteredIds: string[];
}) {
  const [draft, setDraft] = useState<CaptureDraft>({ title: '' });
  const { title, setTitle, error, setError, input, mutation, submit } =
    useCreateTask({
      target: 'today',
      list,
      today,
      filteredIds,
      draft,
      onDraftChange: setDraft,
    });
  return (
    <form
      className="quick-add-widget"
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
          placeholder="Add to today…"
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

export function TodayWidgets({
  progress,
  day,
  list,
  picker,
  filteredIds,
}: {
  progress?: TodayResponse['progress'];
  day?: string;
  filteredIds: string[];
  list?: List;
  picker: ReturnType<typeof useBacklogPicker>;
}) {
  const counts = progress ?? { done: 0, total: 0 };
  const stat = progressWidget(counts);
  const unfinished =
    picker.pickerBacklog.data?.tasks.filter((task) => task.missedFrom) ?? [];
  return (
    <div className="today-widgets">
      <StatWidget
        title="Progress"
        badge={stat.badge}
        number={stat.percent}
        unit={stat.unit}
        fill={stat.fill}
        progress={{
          label: 'Tasks completed today',
          value: counts.done,
          max: counts.total,
        }}
      />
      {unfinished.length > 0 && (
        <section
          className="widget-card unfinished-widget"
          aria-label="Unfinished"
        >
          <div className="widget-heading">
            <h2>Unfinished</h2>
            <span className="widget-badge">{unfinished.length} returned</span>
          </div>
          {unfinished.map((task) => (
            <div className="unfinished-row" key={task.id}>
              <span className="unfinished-check" aria-hidden="true" />
              <span>{task.title}</span>
              <time dateTime={task.missedFrom!}>
                {dateLabel(task.missedFrom!, {
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
            </div>
          ))}
          {picker.error && !picker.planning && (
            <p role="alert" className="field-error">
              {picker.error}
            </p>
          )}
          <Button
            variant="outline"
            disabled={picker.planToday.isPending}
            onClick={() =>
              picker.planToday.mutate(unfinished.map((task) => task.id))
            }
          >
            {unfinished.length === 1
              ? 'Add it to today'
              : `Add ${unfinished.length} to today`}
          </Button>
        </section>
      )}
      <QuickAddWidget list={list} today={day} filteredIds={filteredIds} />
    </div>
  );
}
