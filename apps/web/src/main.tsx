import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { TagEditor } from './TagEditor';

type Priority = 'high' | 'medium' | 'low' | null;
type Tag = { id: string; name: string; color: string };
type Task = { id: string; title: string; note: string | null; priority: Priority; tags: Tag[]; placement: string; status: 'open' | 'done' | 'not_done' };
type Day = { date: string; tasks: Task[] };
type Plan = { backlog: Task[]; today: Day; tomorrow: Day };
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to save changes. Please try again.');
  return data;
}

function App() {
  const [screen, setScreen] = useState<'Plan' | 'History'>('Plan');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTags, setEditingTags] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState<Task | null>(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  const titleInput = useRef<HTMLInputElement | null>(null);
  const closePanel = () => { setSelected(null); opener.current?.focus(); };
  useEffect(() => { request('/plan').then(setPlan).catch(e => setError(e.message)); request('/tags').then(setTags).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!selected) return;
    titleInput.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelected(null); opener.current?.focus(); } };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [selected?.id]);
  useEffect(() => {
    if (!deleted) return;
    const timeout = window.setTimeout(() => setDeleted(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [deleted]);
  const mutate = (path: string, method: string, body?: unknown, after?: () => void) => {
    pending.current++;
    setSaving(true);
    setError('');
    queue.current = queue.current.then(async () => {
      await request(path, method, body);
      setPlan(await request('/plan'));
      const freshTags: Tag[] = await request('/tags');
      setTags(freshTags);
      setTagFilter(current => freshTags.some(tag => tag.id === current) ? current : '');
      setSelected(current => current && { ...current, tags: current.tags.flatMap(tag => freshTags.find(t => t.id === tag.id) || []) });
      after?.();
    }).catch(e => setError(e.message)).finally(() => { pending.current--; setSaving(pending.current > 0); });
  };
  const edit = (field: 'title' | 'note' | 'priority', value: string) => {
    if (!selected) return;
    setSelected({ ...selected, [field]: value || (field === 'title' ? '' : null) });
    if (field === 'title' && !value.trim()) { setError('Enter a title.'); return; }
    mutate(`/tasks/${selected.id}`, 'PATCH', { [field]: value || null });
  };
  return <main className="mx-auto max-w-6xl px-6 py-12">
    <p className="mb-8 text-sm font-semibold tracking-widest opacity-60">DAY PLANNER</p>
    <nav role="tablist" aria-label="Screens" className="mb-10 flex gap-6 border-b border-current/15">
      {(['Plan', 'History'] as const).map(name => <button key={name} id={`tab-${name}`} role="tab" aria-selected={screen === name} aria-controls={`panel-${name}`} onClick={() => setScreen(name)} className={`cursor-pointer border-b-2 px-1 pb-3 text-lg ${screen === name ? 'border-current font-semibold' : 'border-transparent opacity-60'}`}>{name}</button>)}
    </nav>
    {error && <p role="alert" className="mb-4 text-red-700 dark:text-red-300">{error}</p>}
    <section id={`panel-${screen}`} role="tabpanel" aria-labelledby={`tab-${screen}`}>
      <h1 className="mb-6 text-3xl font-semibold">{screen}</h1>
      {screen === 'History' ? <p className="opacity-60">Your past days will appear here.</p> : !plan ? <p role="status">Loading your plan…</p> : <div className="grid gap-6 md:grid-cols-3">
        {[
          { name: 'Backlog', date: null, placement: 'backlog', tasks: plan.backlog.filter(task => !tagFilter || task.tags.some(tag => tag.id === tagFilter)), hint: 'Keep ideas here for another day.' },
          { name: 'Today', date: plan.today.date, placement: plan.today.date, tasks: plan.today.tasks, hint: 'Add a task to start your day.' },
          { name: 'Tomorrow', date: plan.tomorrow.date, placement: plan.tomorrow.date, tasks: plan.tomorrow.tasks, hint: 'Make a little room for tomorrow.' },
        ].map(column => <section key={column.name} aria-label={column.name} className="column flex min-h-64 flex-col rounded-xl border border-current/15 p-4">
          <h2 className="text-lg font-semibold">{column.name}</h2>
          {column.name === 'Backlog' && <label className="mt-2 text-sm">Filter by tag<select className="mt-1 block w-full rounded border border-current/20 p-2" value={tagFilter} onChange={event => setTagFilter(event.target.value)}>
            <option value="">All tags</option>{tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select></label>}
          {column.date && <time dateTime={column.date} className="mb-3 text-sm opacity-60">{column.date}</time>}
          {!column.tasks.length && <p className="my-6 text-sm opacity-60">{column.hint}</p>}
          <ul className="my-3 space-y-2">
            {column.tasks.map(task => <li key={task.id} className="task-card flex items-center gap-2 rounded-lg border border-current/10 p-3">
              {column.placement !== 'backlog' && <input type="checkbox" aria-label={`Mark ${task.title} ${task.status === 'done' ? 'open' : 'done'}`} checked={task.status === 'done'} onChange={() => {
                const status = task.status === 'done' ? 'open' : 'done';
                mutate(`/tasks/${task.id}`, 'PATCH', { status });
                setPlan(current => current && { ...current, today: { ...current.today, tasks: current.today.tasks.map(t => t.id === task.id ? { ...t, status } : t) }, tomorrow: { ...current.tomorrow, tasks: current.tomorrow.tasks.map(t => t.id === task.id ? { ...t, status } : t) } });
              }} />}
              <button className={`min-w-0 flex-1 break-words text-left ${task.status === 'done' ? 'line-through opacity-60' : ''}`} onClick={event => { opener.current = event.currentTarget; setSelected(task); setPickerOpen(false); }}>{task.title}</button>
              <div className="flex flex-wrap gap-1">{task.tags.map(tag => <span key={tag.id} className="rounded border px-2 text-xs" style={{ borderColor: tag.color }}><span style={{ color: tag.color }} aria-hidden="true">● </span><span>{tag.name}</span></span>)}</div>
              {task.priority && <span className={`priority priority-${task.priority}`} aria-label={`${task.priority} priority`} title={`${task.priority} priority`}>●</span>}
            </li>)}
          </ul>
          <form className="mt-auto pt-3" onSubmit={event => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem('title') as HTMLInputElement;
            if (!input.value.trim()) { setError('Enter a title.'); return; }
            const title = input.value;
            mutate('/tasks', 'POST', { title, placement: column.placement }, () => { if (input.value === title) input.value = ''; });
          }}>
            <input className="w-full rounded-lg border border-current/20 px-3 py-2" name="title" aria-label="Add task" placeholder="Add task" autoComplete="off" />
          </form>
        </section>)}
      </div>}
    </section>
    {selected && <aside role="dialog" aria-modal="false" aria-label="Task details" className="details fixed inset-y-0 right-0 z-10 w-full max-w-md overflow-y-auto border-l border-current/20 p-6 shadow-xl">
      <div className="mb-8 flex items-center justify-between"><h2 className="text-xl font-semibold">Task details</h2><button onClick={closePanel} aria-label="Close task details">Close</button></div>
      <label className="mb-6 block">Title<input ref={titleInput} className="mt-2 block w-full rounded border border-current/25 p-2" value={selected.title} onChange={e => edit('title', e.target.value)} /></label>
      <label className="mb-6 block">Note<textarea className="mt-2 block min-h-32 w-full rounded border border-current/25 p-2" value={selected.note || ''} onChange={e => edit('note', e.target.value)} /></label>
      <label className="mb-6 block">Priority<select className="mt-2 block w-full rounded border border-current/25 p-2" value={selected.priority || ''} onChange={e => edit('priority', e.target.value)}>
        <option value="">None</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select></label>
      <div className="mb-6">
        <button aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>Tags</button>
        {pickerOpen && <fieldset className="mt-2 space-y-2 rounded border border-current/20 p-3"><legend className="sr-only">Choose tags</legend>
          {tags.map(tag => <label key={tag.id} className="flex items-center gap-2"><input type="checkbox" checked={selected.tags.some(t => t.id === tag.id)} onChange={event => {
            const next = event.target.checked ? [...selected.tags, tag] : selected.tags.filter(t => t.id !== tag.id);
            setSelected({ ...selected, tags: next });
            mutate(`/tasks/${selected.id}`, 'PATCH', { tagIds: next.map(t => t.id) });
          }} /><span style={{ color: tag.color }} aria-hidden="true">●</span>{tag.name}</label>)}
          <button className="block border-t border-current/20 pt-2" aria-expanded={editingTags} onClick={() => setEditingTags(!editingTags)}>Edit tags</button>
          {editingTags && <TagEditor tags={tags} mutate={mutate} />}
        </fieldset>}
      </div>
      <p role="status" className="mb-6 text-sm opacity-60">{saving ? 'Saving…' : error ? 'Changes not saved' : 'Saved'}</p>
      <button className="text-red-700 dark:text-red-300" onClick={() => {
        const task = selected;
        mutate(`/tasks/${task.id}`, 'DELETE', undefined, () => { setSelected(null); setDeleted(task); });
      }}>Delete task</button>
    </aside>}
    {deleted && <div role="status" className="toast fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-current/20 px-5 py-3 shadow-lg">
      <span>Task deleted ·</span><button className="font-semibold underline" onClick={() => mutate(`/tasks/${deleted.id}/restore`, 'POST', undefined, () => setDeleted(null))}>Undo</button>
    </div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
