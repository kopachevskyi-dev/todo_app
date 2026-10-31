import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { TagEditor } from './TagEditor';
import { PlanBoard } from './PlanBoard';
import { History } from './History';

type Priority = 'high' | 'medium' | 'low' | null;
type Tag = { id: string; name: string; color: string };
type Task = { id: string; title: string; note: string | null; priority: Priority; tags: Tag[]; placement: string; status: 'open' | 'done' | 'not_done'; notDoneFrom: string | null };
type Day = { date: string; tasks: Task[]; reflection: string; done: number; total: number };
type Plan = { backlog: Task[]; today: Day; tomorrow: Day; yesterday: { date: string; reflection: string; showReflectionPrompt: boolean } };
async function request(path: string, method = 'GET', body?: unknown, keepalive = false) {
  const response = await fetch(`/api${path}`, { method, keepalive, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to save changes. Please try again.');
  return data;
}

function ReflectionEditor({ date, initial, label = 'Reflection', onSaved, onEditingChange }: { date: string; initial: string; label?: string; onSaved?: (value: string) => void; onEditingChange?: (editing: boolean) => void }) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState('Saved');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);
  const saved = useRef(initial);
  const lastQueued = useRef(initial);
  const queue = useRef(Promise.resolve());
  const callback = useRef(onSaved);
  callback.current = onSaved;
  const flush = (keepalive = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = latest.current;
    if (value === lastQueued.current) return;
    lastQueued.current = value;
    queue.current = queue.current.then(async () => {
      await request(`/days/${date}`, 'PUT', { reflection: value }, keepalive);
      saved.current = value;
      if (latest.current === value) { setStatus('Saved'); setError(''); callback.current?.(value); }
    }).catch(e => { lastQueued.current = saved.current; setStatus('Changes not saved'); setError(e.message); });
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const pagehide = () => flushRef.current(true);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('pagehide', pagehide);
      if (timer.current) flushRef.current();
    };
  }, []);
  return <div className="mt-6 border-t border-line pt-4">
    <label className="block text-sm font-semibold">{label}<textarea className="mt-2 block min-h-32 w-full rounded-lg border border-line p-3 font-normal" value={draft} onFocus={() => onEditingChange?.(true)} onBlur={() => { flush(); onEditingChange?.(false); }} onChange={event => {
      const value = event.target.value;
      setDraft(value); latest.current = value; setStatus('Saving…'); setError('');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    }} /></label>
    <p role="status" aria-label={`${label} save status`} className="mt-2 text-sm text-text-muted">{status}</p>
    {error && <p role="alert">{error} <button className="underline" onClick={() => flush()}>Retry</button></p>}
  </div>;
}

function App() {
  const [screen, setScreen] = useState<'Plan' | 'History'>('Plan');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editingYesterday, setEditingYesterday] = useState<string | null>(null);
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
    if (!plan) return;
    let active = true;
    let checking = false;
    const checkDate = async () => {
      if (document.visibilityState !== 'visible' || checking) return;
      checking = true;
      try {
        const health = await request('/health');
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: health.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(health.now));
        if (active && date !== plan.today.date) {
          // Let queued saves finish before replacing yesterday's Plan.
          await queue.current;
          const refreshed = await request('/plan');
          if (active) { setPlan(refreshed); setSelected(null); setDeleted(null); }
        }
      } catch (e) { if (active) setError((e as Error).message); }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => { void checkDate(); }, 30_000);
    const visible = () => { void checkDate(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [plan?.today.date]);
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
  const switchScreen = (name: 'Plan' | 'History') => {
    if (name === screen) return;
    if (name === 'Plan') {
      setPlan(null);
      setEditingYesterday(null);
      request('/plan').then(setPlan).catch(e => setError(e.message));
    }
    setScreen(name);
  };
  return <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <p className="type-display mb-8">DAY PLANNER</p>
    <nav role="tablist" aria-label="Screens" className="pill-bar mb-6">
      {(['Plan', 'History'] as const).map(name => <button key={name} id={`tab-${name}`} role="tab" aria-selected={screen === name} aria-controls={`panel-${name}`} onClick={() => switchScreen(name)} className="tab">{name}</button>)}
    </nav>
    {error && <p role="alert" className="error-banner mb-4">{error}</p>}
    <section id={`panel-${screen}`} role="tabpanel" aria-labelledby={`tab-${screen}`} className={screen === 'Plan' ? 'plan-panel' : undefined}>
      <h1 className="type-h1 mb-6">{screen}</h1>
      {screen === 'History' ? plan ? <History today={plan.today.date} ReflectionEditor={ReflectionEditor} /> : <p role="status">Loading your days…</p> : !plan ? <p role="status">Loading your plan…</p> : <>
        <PlanBoard plan={plan} tags={tags} tagFilter={tagFilter} onFilter={setTagFilter} mutate={mutate} onError={setError}
          onToggle={task => {
            const status = task.status === 'done' ? 'open' : 'done';
            mutate(`/tasks/${task.id}`, 'PATCH', { status });
            setPlan(current => current && { ...current,
              backlog: current.backlog.map(t => t.id === task.id ? { ...t, status } : t),
              today: { ...current.today, tasks: current.today.tasks.map(t => t.id === task.id ? { ...t, status } : t) },
              tomorrow: { ...current.tomorrow, tasks: current.tomorrow.tasks.map(t => t.id === task.id ? { ...t, status } : t) },
            });
          }}
          onSelect={(task, button) => { opener.current = button; setSelected(task); setPickerOpen(false); }}
          reflection={<>
            {(plan.yesterday.showReflectionPrompt || editingYesterday === plan.yesterday.date) && <section aria-label="Reflect on yesterday" className="inner-panel plan-reflection mt-6">
              <div className="flex items-center justify-between gap-4"><h2 className="type-label">Reflect on yesterday</h2>
                <button className="button-ghost px-3 py-2" onClick={() => mutate(`/days/${plan.yesterday.date}/dismiss-prompt`, 'POST')}>Dismiss</button>
              </div>
              <p className="type-small mt-2 text-text-muted">What went well? What would you change?</p>
              <ReflectionEditor key={plan.yesterday.date} date={plan.yesterday.date} initial={plan.yesterday.reflection} label="Yesterday's reflection" onEditingChange={editing => setEditingYesterday(editing ? plan.yesterday.date : null)} onSaved={() => { request('/plan').then(setPlan).catch(e => setError(e.message)); }} />
            </section>}
            <div className="inner-panel plan-reflection mt-6"><ReflectionEditor key={plan.today.date} date={plan.today.date} initial={plan.today.reflection} onSaved={reflection => setPlan(current => current && { ...current, today: { ...current.today, reflection } })} /></div></>} /></>}
    </section>
    {selected && <>
    <div aria-hidden="true" className="panel-backdrop pointer-events-none" />
    <aside role="dialog" aria-modal="false" aria-label="Task details" className="details side-panel">
      <div className="mb-8 flex items-center justify-between"><h2 className="type-h2">Task details</h2><button className="button-ghost" onClick={closePanel} aria-label="Close task details">Close</button></div>
      <label className="type-label mb-6 block">Title<input ref={titleInput} className="field mt-2 block" value={selected.title} onChange={e => edit('title', e.target.value)} /></label>
      <label className="type-label mb-6 block">Note<textarea className="field mt-2 block min-h-32" value={selected.note || ''} onChange={e => edit('note', e.target.value)} /></label>
      <label className="type-label mb-6 block">Priority<select className="field mt-2 block" value={selected.priority || ''} onChange={e => edit('priority', e.target.value)}>
        <option value="">None</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select></label>
      <div className="mb-6">
        <button className="button-secondary" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>Tags</button>
        {pickerOpen && <fieldset className="mt-4 min-w-0 space-y-6"><legend className="sr-only">Choose tags</legend>
          <div className="flex flex-wrap gap-2">{tags.map(tag => <label key={tag.id} className="tag-toggle"><input className="tag-toggle-input" type="checkbox" checked={selected.tags.some(t => t.id === tag.id)} onChange={event => {
            const next = event.target.checked ? [...selected.tags, tag] : selected.tags.filter(t => t.id !== tag.id);
            setSelected({ ...selected, tags: next });
            mutate(`/tasks/${selected.id}`, 'PATCH', { tagIds: next.map(t => t.id) });
          }} /><span className="size-2 shrink-0 rounded-pill" style={{ backgroundColor: tag.color }} aria-hidden="true" />{tag.name}</label>)}</div>
          <button className="button-ghost" aria-expanded={editingTags} onClick={() => setEditingTags(!editingTags)}>Edit tags</button>
          {editingTags && <TagEditor tags={tags} mutate={mutate} />}
        </fieldset>}
      </div>
      <p role="status" className="type-small mb-6 text-text-muted">{saving ? 'Saving…' : error ? 'Changes not saved' : 'Saved'}</p>
      <button className="button-destructive" onClick={() => {
        const task = selected;
        mutate(`/tasks/${task.id}`, 'DELETE', undefined, () => { setSelected(null); setDeleted(task); });
      }}>Delete task</button>
    </aside></>}
    {deleted && <div role="status" className="undo-toast">
      <span>Task deleted ·</span><button className="toast-action" onClick={() => mutate(`/tasks/${deleted.id}/restore`, 'POST', undefined, () => setDeleted(null))}>Undo</button>
    </div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
