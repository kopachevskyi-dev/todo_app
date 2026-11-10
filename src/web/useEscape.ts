import { useEffect, useRef } from 'react';

type Handler = { priority: number; run: () => boolean | void };
const handlers = new Set<Handler>();
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing)
    return;
  for (const handler of [...handlers].sort((a, b) => b.priority - a.priority)) {
    if (handler.run() === false) continue;
    event.preventDefault();
    break;
  }
}

export function useEscape(
  onEscape: () => boolean | void,
  priority: number,
  enabled = true,
) {
  const callback = useRef(onEscape);
  useEffect(() => {
    callback.current = onEscape;
  });
  useEffect(() => {
    if (!enabled) return;
    const handler = { priority, run: () => callback.current() };
    if (!handlers.size) document.addEventListener('keydown', escape);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (!handlers.size) document.removeEventListener('keydown', escape);
    };
  }, [priority, enabled]);
}
