import { useEffect, useRef, useState, type ComponentType } from 'react';

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
  return <div>
    <div className="mb-6 flex items-center justify-between gap-4">
      <button className="rounded-lg border border-current/20 px-3 py-2" aria-label="Previous month" onClick={() => changeMonth(-1)}>← <span className="hidden sm:inline">Previous</span></button>
      <h2 className="text-xl font-semibold" aria-live="polite">{monthName}</h2>
      <button className="rounded-lg border border-current/20 px-3 py-2" aria-label="Next month" onClick={() => changeMonth(1)}><span className="hidden sm:inline">Next </span>→</button>
    </div>
    {error && <p role="alert" className="mb-4">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {!summary ? !error && <p role="status">Loading your days…</p> : <>
      <table aria-label={monthName} className="w-full table-fixed border-separate border-spacing-1 sm:border-spacing-2">
        <thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => <th key={name} scope="col" className="pb-2 text-sm font-normal opacity-60">{name}</th>)}</tr></thead>
        <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((date, weekday) => {
          const counts = summary.days.find(value => value.date === date);
          return <td key={weekday} className="p-0">{date && <button
            aria-label={`${date}, ${counts?.done || 0} of ${counts?.total || 0} done`}
            aria-current={date === today ? 'date' : undefined}
            aria-pressed={selected === date}
            disabled={date > today}
            onClick={event => { opener.current = event.currentTarget; setSelected(date); }}
            className={`aspect-square w-full rounded-lg border border-current/10 text-sm disabled:cursor-default disabled:opacity-30 sm:text-base ${date === today ? 'outline-2 outline-offset-2 outline-current font-bold' : ''}`}
            style={{ backgroundColor: date < today && counts?.total ? `rgb(98 123 84 / ${0.12 + 0.58 * counts.done / counts.total})` : 'transparent' }}
          ><time dateTime={date}>{Number(date.slice(-2))}</time></button>}</td>;
        })}</tr>)}</tbody>
      </table>
      <p className="mt-4 text-sm opacity-60">Darker days mean more tasks done. Choose a day to look back.</p>
      {!summary.days.some(value => value.date < today && value.total > 0) && <p className="mt-3 opacity-60">Your past days will appear here.</p>}
    </>}
    {selected && <aside role="dialog" aria-modal="false" aria-label="Day details" className="details fixed inset-y-0 right-0 z-10 w-full max-w-md overflow-y-auto border-l border-current/20 p-6 shadow-xl">
      <div className="mb-6 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold"><time dateTime={selected}>{selected}</time></h2><button ref={closeButton} aria-label="Close day details" onClick={close}>Close</button></div>
      {!day ? !error && <p role="status">Loading your day…</p> : <>
        <p className="mb-4">{day.done} of {day.total} done</p>
        {day.tasks.length ? <ul className="space-y-3">{day.tasks.map(task => <li key={task.id} className="flex items-start justify-between gap-4 rounded-lg border border-current/15 p-3"><span>{task.title}</span><span className="shrink-0 text-sm opacity-60">{task.status === 'done' ? 'Done' : task.status === 'not_done' ? 'Not done' : 'Open'}</span></li>)}</ul> : <p className="opacity-60">No tasks on this day.</p>}
        <ReflectionEditor key={day.date} date={day.date} initial={day.reflection} />
      </>}
    </aside>}
  </div>;
}
