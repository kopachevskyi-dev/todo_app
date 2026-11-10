import { useEffect, useRef, useState } from 'react';
import { Icon } from './components';
export function SearchField({
  query,
  onQuery,
  onEscape,
  autoFocus = false,
  screen,
}: {
  query: string;
  onQuery: (query: string) => void;
  onEscape: () => void;
  autoFocus?: boolean;
  screen: string;
}) {
  const [draft, setDraft] = useState({ query, value: query });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (draft.query !== query) setDraft({ query, value: query });
  useEffect(() => () => clearTimeout(timer.current), [screen]);
  return (
    <label className="search-field">
      <Icon name="search" size={18} />
      <input
        type="text"
        aria-label="Search"
        placeholder="Search"
        autoFocus={autoFocus}
        value={draft.value}
        onChange={(event) => {
          const value = event.target.value;
          setDraft({ query, value });
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onQuery(value), 200);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            clearTimeout(timer.current);
            setDraft({ query, value: '' });
            onEscape();
          }
        }}
      />
    </label>
  );
}
