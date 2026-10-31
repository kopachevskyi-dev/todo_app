import { useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, pointerWithin, useSensor, useSensors, useDroppable, useDndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Tag = { id: string; name: string; color: string };
type Task = { id: string; title: string; placement: string; status: string; tags: Tag[]; priority: string | null; notDoneFrom: string | null };
type Day<T> = { date: string; tasks: T[] };
type Column<T> = { name: string; placement: string; tasks: T[]; hint: string };
type Props<T extends Task> = {
  plan: { backlog: T[]; today: Day<T>; tomorrow: Day<T> };
  tags: Tag[];
  tagFilter: string;
  onFilter: (value: string) => void;
  onSelect: (task: T, button: HTMLButtonElement) => void;
  onToggle: (task: T) => void;
  mutate: (path: string, method: string, body?: unknown, after?: () => void) => void;
  onError: (message: string) => void;
  reflection: ReactNode;
};

function TaskCard<T extends Task>({ task, columns, onSelect, onToggle, mutate }: { task: T; columns: Column<T>[]; onSelect: Props<T>['onSelect']; onToggle: Props<T>['onToggle']; mutate: Props<T>['mutate'] }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id, data: { placement: task.placement } });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-dragging={isDragging} className="task-card relative flex min-w-0 flex-wrap items-center gap-2 rounded-item bg-surface-raised px-4 py-3 type-body">
    <button {...attributes} {...listeners} aria-label={`Drag ${task.title}`} className="drag-handle button-ghost shrink-0 touch-none p-1 text-text-faint" title="Drag task"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 3h1m4 0h1M5 8h1m4 0h1M5 13h1m4 0h1" strokeLinecap="round" /></svg></button>
    <input type="checkbox" className="checkbox" aria-label={`Mark ${task.title} ${task.status === 'done' ? 'open' : 'done'}`} checked={task.status === 'done'} onChange={() => onToggle(task)} />
    <div className="min-w-0 flex-1">
      <button className={`w-full break-words text-left ${task.status === 'done' ? 'line-through text-text-faint' : task.notDoneFrom && task.placement === 'backlog' ? 'text-text-muted' : ''}`} onClick={event => onSelect(task, event.currentTarget)}>{task.title}</button>
      {task.placement === 'backlog' && task.notDoneFrom && <p className="chip-danger mt-1 whitespace-nowrap">Not done · <time dateTime={task.notDoneFrom}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${task.notDoneFrom}T12:00:00Z`))}</time></p>}
    </div>
    {(task.tags.length > 0 || task.priority) && <div className="flex w-full min-w-0 flex-wrap gap-2">
      {task.tags.map(tag => <span key={tag.id} className="chip-neutral max-w-full"><span className="size-2 shrink-0 rounded-pill" style={{ backgroundColor: tag.color }} aria-hidden="true" /><span className="min-w-0 break-words">{tag.name}</span></span>)}
      {task.priority && <span className="chip-priority" data-priority={task.priority} aria-label={`${task.priority} priority`} title={`${task.priority} priority`}>{task.priority}</span>}
    </div>}
    <select aria-label={`Move ${task.title} to…`} className="move-task select-field" value="" onChange={event => { if (event.target.value) mutate(`/tasks/${task.id}/move`, 'POST', { placement: event.target.value }); }}>
      <option value="" disabled>Move to…</option>{columns.filter(column => column.placement !== task.placement).map(column => <option key={column.placement} value={column.placement}>{column.name}</option>)}
    </select>
  </li>;
}

function PlanColumn<T extends Task>({ column, children }: { column: Column<T>; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.placement, data: { placement: column.placement } });
  const { over } = useDndContext();
  const highlighted = isOver || over?.data.current?.placement === column.placement;
  return <section ref={setNodeRef} id={`column-panel-${column.name}`} aria-label={column.name} data-column={column.name} data-drag-over={highlighted} className="column plan-column card flex min-h-64 min-w-0 flex-col">
    {children}
  </section>;
}

export function PlanBoard<T extends Task>({ plan, tags, tagFilter, onFilter, onSelect, onToggle, mutate, onError, reflection }: Props<T>) {
  const [activeColumn, setActiveColumn] = useState('Today');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const columns: Column<T>[] = [
    { name: 'Backlog', placement: 'backlog', tasks: plan.backlog.filter(task => !tagFilter || task.tags.some(tag => tag.id === tagFilter)), hint: 'Keep ideas here for another day.' },
    { name: 'Today', placement: plan.today.date, tasks: plan.today.tasks, hint: 'Add a task to start your day.' },
    { name: 'Tomorrow', placement: plan.tomorrow.date, tasks: plan.tomorrow.tasks, hint: 'Make a little room for tomorrow.' },
  ];
  const move = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const source = columns.find(column => column.tasks.some(task => task.id === active.id));
    const target = columns.find(column => column.placement === over.id || column.tasks.some(task => task.id === over.id));
    if (!source || !target || (source === target && target.placement === 'backlog')) return;
    const remaining = target.tasks.filter(task => task.id !== active.id);
    let position = remaining.findIndex(task => task.id === over.id);
    if (position < 0) position = remaining.length;
    else if (active.rect.current.translated && active.rect.current.translated.top + active.rect.current.translated.height / 2 > over.rect.top + over.rect.height / 2) position++;
    mutate(`/tasks/${active.id}/move`, 'POST', { placement: target.placement, ...(target.placement === 'backlog' ? {} : { position }) });
  };
  return <div className="plan-board" data-active-column={activeColumn}>
    <div role="tablist" aria-label="Plan columns" className="column-tabs pill-bar mb-6">
      {columns.map((column, index) => <button key={column.name} role="tab" id={`column-tab-${column.name}`} aria-selected={activeColumn === column.name} aria-controls={`column-panel-${column.name}`} tabIndex={activeColumn === column.name ? 0 : -1} className="tab flex-1 px-2" onClick={() => setActiveColumn(column.name)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
        if (next >= 0) { event.preventDefault(); setActiveColumn(columns[next].name); document.getElementById(`column-tab-${columns[next].name}`)?.focus(); }
      }}>{column.name}</button>)}
    </div>
    <DndContext sensors={sensors} collisionDetection={args => {
      const hits = pointerWithin(args);
      const cards = hits.filter(hit => columns.every(column => column.placement !== hit.id));
      return cards.length ? cards : hits.length ? hits : closestCenter(args);
    }} onDragEnd={move}>
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {columns.map(column => <PlanColumn key={column.name} column={column}>
          <div>
            <h2 className="type-h2">{column.name}</h2>
            {column.name === 'Backlog' && <label className="type-label mt-6 block text-text-muted">Filter by tag<select className="select-field mt-2 block normal-case tracking-normal" value={tagFilter} onChange={event => onFilter(event.target.value)}>
              <option value="">All tags</option>{tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select></label>}
            {column.placement !== 'backlog' && <><p className="type-small mt-1 text-text-muted">{column.tasks.filter(task => task.status === 'done').length} of {column.tasks.length} done</p><time dateTime={column.placement} className="type-small text-text-muted">{column.placement}</time></>}
            {!column.tasks.length && <p className="type-body my-6 text-center text-text-muted">{column.hint}</p>}
            <SortableContext items={column.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
              <ul className="my-6 space-y-3">{column.tasks.map(task => <TaskCard key={task.id} task={task} columns={columns} onSelect={onSelect} onToggle={onToggle} mutate={mutate} />)}</ul>
            </SortableContext>
          </div>
          <form className="mt-auto pt-6" onSubmit={event => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem('title') as HTMLInputElement;
            if (!input.value.trim()) { onError('Enter a title.'); return; }
            const title = input.value;
            mutate('/tasks', 'POST', { title, placement: column.placement }, () => { if (input.value === title) input.value = ''; });
          }}><input className="field" name="title" aria-label="Add task" placeholder="Add task" autoComplete="off" /></form>
          {column.name === 'Today' && reflection}
        </PlanColumn>)}
      </div>
    </DndContext>
  </div>;
}
