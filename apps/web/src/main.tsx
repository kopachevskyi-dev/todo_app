import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [screen, setScreen] = useState<'Plan' | 'History'>('Plan');
  return <main className="mx-auto max-w-5xl px-6 py-12">
    <p className="mb-8 text-sm font-semibold tracking-widest opacity-60">DAY PLANNER</p>
    <nav role="tablist" aria-label="Screens" className="mb-10 flex gap-6 border-b border-current/15">
      {(['Plan', 'History'] as const).map(name => <button key={name} id={`tab-${name}`} role="tab" aria-selected={screen === name} aria-controls={`panel-${name}`} onClick={() => setScreen(name)} className={`cursor-pointer border-b-2 px-1 pb-3 text-lg ${screen === name ? 'border-current font-semibold' : 'border-transparent opacity-60'}`}>{name}</button>)}
    </nav>
    <section id={`panel-${screen}`} role="tabpanel" aria-labelledby={`tab-${screen}`}>
      <h1 className="mb-3 text-3xl font-semibold">{screen}</h1>
      <p className="opacity-60">{screen === 'Plan' ? 'A little space to plan your day.' : 'Your past days will appear here.'}</p>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
