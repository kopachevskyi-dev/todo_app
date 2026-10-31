import { useEffect, useRef, useState, type CSSProperties, type ComponentType } from 'react';

type Summary = { date: string; total: number; done: number };
type Day = Summary & { reflection: string; tasks: { id: string; title: string; status: 'open' | 'done' | 'not_done' }[] };

async function read(path: string) {
  const response = await fetch(`/api${path}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to load History. Please try again.');
  return data;
}

export function History({ today, ReflectionEditor }: { today: string; ReflectionEditor: ComponentType<{ date: string; initial: string }> }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [summary, setSummary] = useState<{ month: string; days: Summary[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const close = () => { setSelected(null); opener.current?.focus(); };
  useEffect(() => {
    let active = true;
    setError(''); setSummary(null);
    read(`/history?month=${month}`).then(value => { if (active) setSummary(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [month, retry]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDay(null); setError('');
    closeButton.current?.focus();
    read(`/days/${selected}`).then(value => { if (active) setDay(value); }).catch(e => { if (active) setError(e.message); });
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', keydown);
    return () => { active = false; window.removeEventListener('keydown', keydown); };
  }, [selected, retry]);
  const first = new Date(`${month}-01T12:00:00Z`);
  const monthName = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const weeks = Array.from({ length: Math.ceil((offset + last.getUTCDate()) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const number = week * 7 + weekday - offset + 1;
      return number > 0 && number <= last.getUTCDate() ? `${month}-${String(number).padStart(2, '0')}` : null;
    }));
  const changeMonth = (amount: number) => {
    first.setUTCMonth(first.getUTCMonth() + amount);
    setMonth(first.toISOString().slice(0, 7)); setSelected(null);
  };
  return <div className="card">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <button className="button-secondary" aria-label="Previous month" onClick={() => changeMonth(-1)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 8H3m5-5L3 8l5 5" /></svg>Previous</button>
      <h2 className="type-h2 order-first w-full text-center md:order-none md:w-auto" aria-live="polite">{monthName}</h2>
      <button className="button-secondary" aria-label="Next month" onClick={() => changeMonth(1)}>Next<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M8 3l5 5-5 5" /></svg></button>
    </div>
    {error && <p role="alert" className="error-banner mb-4">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {!summary ? !error && <p role="status">Loading your days…</p> : <>
      <table aria-label={monthName} className="w-full table-fixed border-separate border-spacing-1 md:border-spacing-2">
        <thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => <th key={name} scope="col" className="type-small pb-2 text-text-muted">{name}</th>)}</tr></thead>
        <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((date, weekday) => {
          const counts = summary.days.find(value => value.date === date);
          return <td key={weekday} className="p-0">{date && <button
            aria-label={`${date}, ${counts?.done || 0} of ${counts?.total || 0} done`}
            aria-current={date === today ? 'date' : undefined}
            aria-pressed={selected === date}
            disabled={date > today}
            onClick={event => { opener.current = event.currentTarget; setSelected(date); }}
            className="history-cell"
            style={{ '--history-background': date < today && counts?.total ? `color-mix(in srgb, var(--color-surface-raised), var(--color-text) ${12 + 58 * counts.done / counts.total}%)` : 'var(--color-surface-raised)' } as CSSProperties}
          ><time dateTime={date}>{Number(date.slice(-2))}</time></button>}</td>;
        })}</tr>)}</tbody>
      </table>
      <p className="type-small mt-4 text-text-muted">Darker days mean more tasks done. Choose a day to look back.</p>
      {!summary.days.some(value => value.date < today && value.total > 0) && <p className="my-6 text-center text-text-muted">Your past days will appear here.</p>}
    </>}
    {selected && <>
    <div aria-hidden="true" className="panel-backdrop pointer-events-none" />
    <aside role="dialog" aria-modal="false" aria-label="Day details" className="details side-panel">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h2 className="type-h2"><time dateTime={selected}>{selected}</time></h2><button className="button-ghost" ref={closeButton} aria-label="Close day details" onClick={close}>Close</button></div>
      {!day ? !error && <p role="status">Loading your day…</p> : <>
        <p className="mb-6 text-text-muted">{day.done} of {day.total} done</p>
        {day.tasks.length ? <ul className="mb-6 space-y-3">{day.tasks.map(task => <li key={task.id} className="flex items-start justify-between gap-4 rounded-item bg-surface-raised px-4 py-3"><span className={task.status === 'done' ? 'min-w-0 break-words text-text-faint line-through' : 'min-w-0 break-words'}>{task.title}</span><span className="type-small shrink-0 text-text-muted">{task.status === 'done' ? 'Done' : task.status === 'not_done' ? 'Not done' : 'Open'}</span></li>)}</ul> : <p className="mb-6 text-text-muted">No tasks on this day.</p>}
        <div className="history-reflection"><ReflectionEditor key={day.date} date={day.date} initial={day.reflection} /></div>
      </>}
    </aside></>}
  </div>;
}
