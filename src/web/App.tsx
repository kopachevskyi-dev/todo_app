import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { searchLocationText } from '../domain/search';
import { api } from './api';
import {
  BottomSheet,
  Button,
  CountPill,
  EmptyPanel,
  Icon,
  Modal,
  QuickAdd,
  SectionLabel,
  TaskRow,
} from './components';
import { captureLayout } from './layout-animation';
import type {
  Counts,
  CreateTaskRequest,
  TaskRow as TaskRowData,
} from '../shared/contract';

function useMedia(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
  );
}
const tabs = [
  { to: '/backlog', label: 'Backlog', icon: 'backlog' },
  { to: '/today', label: 'Today', icon: 'today' },
  { to: '/history', label: 'History', icon: 'history' },
] as const;

function SearchField({
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

function Capture({
  target,
  mobile = false,
  onAdded,
}: {
  target: 'backlog' | 'today';
  mobile?: boolean;
  onAdded?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.createTask,
    onMutate: async (request: CreateTaskRequest) => {
      await Promise.all([
        client.cancelQueries({ queryKey: ['backlog'] }),
        client.cancelQueries({ queryKey: ['counts'] }),
      ]);
      const previousBacklog = client.getQueryData<{ tasks: TaskRowData[] }>([
        'backlog',
        undefined,
      ]);
      const previousCounts = client.getQueryData<Counts>(['counts']);
      const id = `optimistic-${globalThis.crypto.randomUUID()}`;
      if (request.target === 'backlog') {
        const optimistic: TaskRowData = {
          id,
          title: request.title,
          description: '',
          listId: null,
          list: null,
          day: null,
          completedAt: null,
          missedFrom: null,
          subtaskCount: 0,
          subtaskDoneCount: 0,
          createdAt: '1970-01-01T00:00:00.000Z',
          updatedAt: '1970-01-01T00:00:00.000Z',
        };
        client.setQueryData(['backlog', undefined], {
          tasks: [optimistic, ...(previousBacklog?.tasks ?? [])],
        });
      }
      if (previousCounts)
        client.setQueryData<Counts>(['counts'], {
          ...previousCounts,
          backlog:
            previousCounts.backlog + (request.target === 'backlog' ? 1 : 0),
          todayOpen:
            previousCounts.todayOpen + (request.target === 'today' ? 1 : 0),
          todayTotal:
            previousCounts.todayTotal + (request.target === 'today' ? 1 : 0),
        });
      return { previousBacklog, previousCounts, id };
    },
    onError: (failure, _request, context) => {
      if (context?.previousBacklog)
        client.setQueryData(['backlog', undefined], context.previousBacklog);
      else client.setQueryData(['backlog', undefined], { tasks: [] });
      if (context?.previousCounts)
        client.setQueryData(['counts'], context.previousCounts);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not add the task. Try again.',
      );
      input.current?.focus();
    },
    onSuccess: ({ task }, request, context) => {
      client.setQueryData<{ tasks: TaskRowData[] }>(
        ['backlog', undefined],
        (previous) =>
          previous && {
            tasks: previous.tasks.map((row) =>
              row.id === context.id ? { ...task, list: null } : row,
            ),
          },
      );
      setTitle((current) => (current.trim() === request.title ? '' : current));
      input.current?.focus();
      onAdded?.();
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['backlog'] });
      void client.invalidateQueries({ queryKey: ['counts'] });
    },
  });
  const submit = () => {
    if (mutation.isPending || !title.trim()) return;
    if (title.trim().length > 200) {
      setError('Title must be between 1 and 200 characters.');
      return;
    }
    setError(undefined);
    mutation.mutate({ title: title.trim(), target });
  };
  return (
    <QuickAdd
      value={title}
      onChange={(value) => {
        setTitle(value);
        setError(undefined);
      }}
      onSubmit={submit}
      inputRef={input}
      error={error}
      pending={mutation.isPending}
      mobile={mobile}
      target={target}
    />
  );
}

function Detail({ id }: { id?: string }) {
  const task = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.task(id!),
    enabled: Boolean(id),
  });
  if (!id) return <EmptyPanel>Select a task to add details</EmptyPanel>;
  if (task.isError)
    return (
      <p role="alert" className="field-error">
        <Icon name="error" size={16} />
        {task.error.message}
      </p>
    );
  return task.data ? (
    <h2 className="detail-title">{task.data.task.title}</h2>
  ) : (
    <p role="status">Loading task…</p>
  );
}

export function App() {
  const path = useLocation({ select: (location) => location.pathname });
  const { task, list, q } = useSearch({ strict: false });
  const navigate = useNavigate();
  const mobile = useMedia('(max-width: 767px)');
  const desktop = useMedia('(min-width: 1216px)');
  const [capturing, setCapturing] = useState(false);
  const isBacklog = path === '/backlog';
  const isSearch = path === '/search';
  const previousScreen = useRef<{
    to: '/backlog' | '/today' | '/history';
    search: { list?: string; task?: string };
  }>({ to: '/today', search: {} });
  useEffect(() => {
    if (path !== '/search')
      previousScreen.current = {
        to: path as '/backlog' | '/today' | '/history',
        search: { list, task },
      };
  }, [path, list, task]);
  const changeQuery = (value: string) => {
    void navigate({ to: '/search', search: { q: value }, replace: isSearch });
  };
  const leaveSearch = () => {
    void navigate(previousScreen.current);
  };
  const search = useQuery({
    queryKey: ['search', q?.trim()],
    queryFn: () => api.search(q!.trim()),
    enabled: isSearch && Boolean(q?.trim()),
  });
  const title = tabs.find((tab) => tab.to === path)?.label ?? 'Search';
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const counts = useQuery({ queryKey: ['counts'], queryFn: api.counts });
  const backlog = useQuery({
    queryKey: ['backlog', list],
    queryFn: () => api.backlog(list),
    enabled: isBacklog,
  });
  const rows = backlog.data?.tasks;
  const rowContainer = useRef<HTMLUListElement>(null);
  const animateLayout = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    animateLayout.current?.();
    if (rowContainer.current)
      animateLayout.current = captureLayout(rowContainer.current);
  }, [rows]);
  const closeTask = () => {
    void navigate({
      to: path as '/backlog' | '/today' | '/history' | '/search',
      search: (previous) => ({ ...previous, task: undefined }),
    });
  };
  const openTask = (id: string) => {
    void navigate({
      to: path as '/backlog' | '/today' | '/history' | '/search',
      search: (previous) => ({ ...previous, task: id }),
    });
  };
  const nav = (
    <>
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          search={{ list }}
          aria-current={path === tab.to ? 'page' : undefined}
          className="nav-link"
        >
          <span className="nav-icon">
            <Icon name={tab.icon} size={mobile ? 22 : 20} />
          </span>
          <span className="nav-label">{tab.label}</span>
          {!mobile && tab.to !== '/history' && (
            <span className="nav-count">
              {tab.to === '/backlog'
                ? (counts.data?.backlog ?? 0)
                : (counts.data?.todayOpen ?? 0)}
            </span>
          )}
        </Link>
      ))}
    </>
  );
  return (
    <div className={`app-shell ${mobile && task ? 'task-pushed' : ''}`}>
      {!mobile && (
        <div className="sidebar">
          <div className="sidebar-top">
            <div className="app-name">Tasks</div>
            <nav aria-label="Search tasks">
              <SearchField
                screen={path}
                query={isSearch ? (q ?? '') : ''}
                onQuery={changeQuery}
                onEscape={leaveSearch}
              />
            </nav>
          </div>
          <nav aria-label="Sections">{nav}</nav>
          <div className="lists">
            <SectionLabel>Lists</SectionLabel>
            {lists.data?.lists.map((item) => (
              <Link
                key={item.id}
                to={path as '/backlog' | '/today' | '/history' | '/search'}
                search={{ list: list === item.id ? undefined : item.id }}
                className="list-link"
                aria-current={list === item.id ? 'true' : undefined}
              >
                <span className="list-dot" style={{ background: item.color }} />
                {item.name}
              </Link>
            ))}
            {lists.isError && <p role="alert">Could not load lists.</p>}
            <div className="new-list">
              <Icon name="plus" size={14} />
              New list
            </div>
          </div>
        </div>
      )}
      {!(mobile && task) && (
        <main className="main-column">
          <header className="screen-header">
            {mobile && isSearch && (
              <button className="back-link search-back" onClick={leaveSearch}>
                ‹ Back
              </button>
            )}
            <div className="screen-heading">
              <h1>
                {title}
                {isBacklog && (
                  <CountPill>
                    {list ? (rows?.length ?? 0) : (counts.data?.backlog ?? 0)}
                  </CountPill>
                )}
              </h1>
              {mobile && !isSearch && (
                <Button
                  variant="icon"
                  aria-label="Search"
                  onClick={() => changeQuery('')}
                >
                  <Icon name="search" />
                </Button>
              )}
            </div>
            {mobile && isSearch && (
              <SearchField
                screen={path}
                query={q ?? ''}
                onQuery={changeQuery}
                onEscape={leaveSearch}
                autoFocus
              />
            )}
            {isSearch && q?.trim() && search.data && (
              <p>
                {search.data.results.length} results for "{q.trim()}"
              </p>
            )}
            {isBacklog && (
              <p>
                Everything you need to do someday.
                <span className="desktop-subtitle">
                  {' '}
                  No date until you plan it.
                </span>
              </p>
            )}
          </header>
          {isSearch && q?.trim() && (
            <>
              {search.isPending && <p role="status">Searching…</p>}
              {search.isError && (
                <p role="alert" className="field-error">
                  Could not search tasks.{' '}
                  <Button
                    variant="outline"
                    onClick={() => {
                      void search.refetch();
                    }}
                  >
                    Try again
                  </Button>
                </p>
              )}
              {search.data?.results.length === 0 && (
                <EmptyPanel>No tasks match</EmptyPanel>
              )}
              <ul className="task-list">
                {search.data?.results.map((row) => (
                  <TaskRow
                    key={row.id}
                    task={row}
                    selected={row.id === task}
                    location={searchLocationText(row.location)}
                    href={`/search?${new URLSearchParams({ q: q ?? '', task: row.id })}`}
                    onOpen={() => openTask(row.id)}
                  />
                ))}
              </ul>
            </>
          )}
          {isBacklog && (
            <>
              {!mobile && <Capture target="backlog" />}
              {backlog.isPending && <p role="status">Loading tasks…</p>}
              {backlog.isError && (
                <p role="alert" className="field-error">
                  <Icon name="error" size={16} />
                  Could not load tasks.{' '}
                  <Button
                    variant="outline"
                    onClick={() => {
                      void backlog.refetch();
                    }}
                  >
                    Try again
                  </Button>
                </p>
              )}
              {rows?.length === 0 && (
                <EmptyPanel>Nothing waiting. Add a task above.</EmptyPanel>
              )}
              <ul ref={rowContainer} className="task-list">
                {rows?.map((row) => {
                  const params = new URLSearchParams({
                    ...(list ? { list } : {}),
                    task: row.id,
                  });
                  return (
                    <TaskRow
                      key={row.id}
                      task={row}
                      selected={row.id === task}
                      href={`/backlog?${params}`}
                      onOpen={() => openTask(row.id)}
                    />
                  );
                })}
              </ul>
            </>
          )}
        </main>
      )}
      {desktop && (
        <aside
          className={`detail-panel ${task ? 'has-task' : ''}`}
          aria-label="Task details"
        >
          {task && (
            <div className="detail-header">
              <span>Task</span>
              <Button variant="ghost" aria-label="Close" onClick={closeTask}>
                <Icon name="close" />
              </Button>
            </div>
          )}
          <Detail id={task} />
        </aside>
      )}
      {!desktop && !mobile && task && (
        <Modal
          label="Task details"
          className="detail-drawer"
          onClose={closeTask}
        >
          <div className="detail-header">
            <span>Task</span>
            <Button variant="ghost" aria-label="Close" onClick={closeTask}>
              <Icon name="close" />
            </Button>
          </div>
          <Detail id={task} />
        </Modal>
      )}
      {mobile && task && (
        <main className="pushed-detail">
          <Link
            to={path as '/backlog' | '/today' | '/history' | '/search'}
            search={(previous) => ({ ...previous, task: undefined })}
            className="back-link"
          >
            ‹ {title}
          </Link>
          <Detail id={task} />
        </main>
      )}
      {mobile && !task && (
        <>
          <nav aria-label="Sections" className="tab-bar">
            {nav}
          </nav>
          {(isBacklog || path === '/today') && (
            <Button
              className="fab"
              aria-label="Add task"
              onClick={() => setCapturing(true)}
            >
              <Icon name="plus" size={24} />
            </Button>
          )}
        </>
      )}
      {capturing && mobile && !task && (
        <BottomSheet label="New task" onClose={() => setCapturing(false)}>
          <h3 className="sheet-label">New task</h3>
          <Capture
            target={isBacklog ? 'backlog' : 'today'}
            mobile
            onAdded={() => setCapturing(false)}
          />
        </BottomSheet>
      )}
    </div>
  );
}
