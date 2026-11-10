import { useBacklogPicker } from './useBacklogPicker';
import { browserTimeZone } from './dates';
import { formatShortDate } from './dates';
import { Button, Icon } from './components';
export function BacklogPicker({
  mobile,
  picker,
}: {
  mobile: boolean;
  picker: ReturnType<typeof useBacklogPicker>;
}) {
  const { pickerBacklog, plannedSelection, setPlannedSelection, planToday } =
    picker;
  const tasks = pickerBacklog.data?.tasks ?? [];
  const groups = [
    { label: 'Unfinished', tasks: tasks.filter((task) => task.missedFrom) },
    { label: 'Backlog', tasks: tasks.filter((task) => !task.missedFrom) },
  ];
  return (
    <>
      {mobile && <h2 className="planner-title">Add from Backlog</h2>}
      <p className="row-meta">All lists</p>
      {picker.error && (
        <p role="alert" className="field-error">
          {picker.error}
        </p>
      )}
      <div className="planner-rows">
        {pickerBacklog.isPending && <p role="status">Loading tasks…</p>}
        {pickerBacklog.isError && (
          <p role="alert">Could not load backlog tasks.</p>
        )}
        {pickerBacklog.data?.tasks.length === 0 && (
          <p className="planner-empty">Nothing waiting in the backlog.</p>
        )}
        {groups.map(
          (group) =>
            group.tasks.length > 0 && (
              <section key={group.label} aria-label={group.label}>
                <h3 className="section-label">{group.label}</h3>
                {group.tasks.map((task) => {
                  const checked = plannedSelection.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={planToday.isPending}
                      className={`planner-row ${checked ? 'row-selected' : ''}`}
                      onClick={() =>
                        setPlannedSelection((current) =>
                          checked
                            ? current.filter((id) => id !== task.id)
                            : [...current, task.id],
                        )
                      }
                    >
                      <span
                        className={`planner-check ${checked ? 'checked' : ''}`}
                      >
                        {checked && <Icon name="check" size={16} />}
                      </span>
                      <span className="planner-row-text">
                        <span>{task.title}</span>
                        {(task.list || task.missedFrom) && (
                          <span className="row-meta">
                            {task.list && (
                              <>
                                <span
                                  className="list-dot"
                                  style={{ background: task.list.color }}
                                />
                                {task.list.name}
                              </>
                            )}
                            {task.missedFrom && (
                              <>
                                {task.list && ' · '}
                                was{' '}
                                {formatShortDate(
                                  task.missedFrom,
                                  browserTimeZone(),
                                )}
                              </>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </section>
            ),
        )}
      </div>
      <Button
        className="planner-submit"
        disabled={plannedSelection.length === 0 || planToday.isPending}
        onClick={() => planToday.mutate(plannedSelection)}
      >
        Add {plannedSelection.length} to Today
      </Button>
    </>
  );
}
