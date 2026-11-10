import { useBacklogPicker } from './useBacklogPicker';
import { useEscape } from './useEscape';
import { queryKeys } from './query-keys';
import { useRollover } from './useRollover';
import { TaskSurface } from './TaskSurface';
import { ScreenHeader } from './ScreenHeader';
import { Search } from './Search';
import { Today } from './Today';
import { Backlog } from './Backlog';
import { BacklogPicker } from './BacklogPicker';
import { SearchField } from './SearchField';
import { Capture } from './Capture';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
  useSearch,
} from '@tanstack/react-router';
import { useMutationState, useQuery } from '@tanstack/react-query';

import { api } from './api';
import { useCompletion } from './useCompletion';
import { createTaskMutationKey, type CreateTaskContext } from './useCreateTask';
import { BottomSheet, Button, Icon, Popover } from './components';
import { Lists } from './Lists';
import { Upcoming } from './Upcoming';
import { History } from './History';
import { captureLayout } from './layout-animation';

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

export function App() {
  useRollover();
  const location = useLocation();
  const path = location.pathname;
  const router = useRouter();
  const { task, lists: listFilter, q, from } = useSearch({ strict: false });
  const navigate = useNavigate();
  const mobile = useMedia('(max-width: 767px)');
  const desktop = useMedia('(min-width: 1216px)');
  const [capturing, setCapturing] = useState(false);
  const picker = useBacklogPicker();
  const { planning, closePlanner, openPlanner } = picker;
  const planButton = useRef<HTMLButtonElement>(null);
  const isBacklog = path === '/backlog';
  const isToday = path === '/today';
  const completion = useCompletion();
  const isSearch = path === '/search';
  const changeQuery = (value: string) => {
    void navigate({
      to: '/search',
      search: { q: value, from: isSearch ? from : location.href },
      replace: isSearch,
    });
  };
  const leaveSearch = () => {
    if (isSearch) void navigate({ href: from ?? '/today' });
  };
  const search = useQuery({
    queryKey: queryKeys.searchQuery(q?.trim()),
    queryFn: () => api.search(q!.trim()),
    enabled: isSearch && Boolean(q?.trim()),
  });
  const title =
    tabs.find((tab) => tab.to === path)?.label ??
    (path === '/upcoming' ? 'Upcoming' : 'Search');
  // Pending UI comes from the mutation, so focus refetches cannot erase it.
  const pendingCreates = useMutationState({
    filters: { mutationKey: createTaskMutationKey, status: 'pending' },
    select: (mutation) =>
      mutation.state.context as CreateTaskContext | undefined,
  }).filter((context) => context !== undefined);
  const pendingBacklog = pendingCreates.filter(
    ({ request }) => request.target === 'backlog',
  );
  const pendingToday = pendingCreates.length - pendingBacklog.length;
  const lists = useQuery({ queryKey: queryKeys.lists, queryFn: api.lists });
  const counts = useQuery({
    queryKey: queryKeys.counts,
    queryFn: api.counts,
    select: (data) => ({
      ...data,
      backlog: data.backlog + pendingBacklog.length,
      todayOpen: data.todayOpen + pendingToday,
      todayTotal: data.todayTotal + pendingToday,
    }),
  });
  const selectedIds = listFilter?.split(',').filter(Boolean) ?? [];
  const activeLists =
    lists.data?.lists.filter((item) => selectedIds.includes(item.id)) ?? [];
  const activeList = activeLists.length === 1 ? activeLists[0] : undefined;
  const scope = activeLists.map((item) => item.name).join(', ') || listFilter;
  const matchesList = (row: { listId: string | null }) =>
    !listFilter || Boolean(row.listId && selectedIds.includes(row.listId));
  const filterList = (id?: string) => {
    const next = id
      ? selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id]
      : [];
    void navigate({
      to: path as '/backlog' | '/today' | '/history' | '/search' | '/upcoming',
      search: (previous) => ({
        ...previous,
        lists: next.length ? next.join(',') : undefined,
        task: undefined,
      }),
    });
  };
  const backlog = useQuery({
    queryKey: queryKeys.backlogList(),
    queryFn: () => api.backlog(),
    enabled: isBacklog,
    select: (data) => ({
      tasks: [
        ...pendingBacklog
          .slice()
          .reverse()
          .map(({ row }) => row),
        ...data.tasks,
      ].filter(matchesList),
    }),
  });
  const today = useQuery({
    queryKey: queryKeys.todayList(),
    queryFn: () => api.today(),
    enabled: isToday,
    select: (data) => ({
      ...data,
      open: data.open.filter(matchesList),
      done: data.done.filter(matchesList),
    }),
  });
  const upcoming = useQuery({
    queryKey: queryKeys.upcoming,
    queryFn: api.upcoming,
    enabled: isToday || path === '/upcoming',
  });
  const rows = isToday ? today.data?.open : backlog.data?.tasks;
  const rowContainer = useRef<HTMLUListElement>(null);
  const animateLayout = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    animateLayout.current?.();
    if (rowContainer.current)
      animateLayout.current = captureLayout(rowContainer.current);
  }, [rows, today.data?.done]);
  const closeTask = () => {
    // Async task actions may finish after the user has navigated elsewhere.
    if (!task || router.history.location.href !== location.href) return;
    void navigate({
      to: path as '/backlog' | '/today' | '/history' | '/search' | '/upcoming',
      search: (previous) => ({ ...previous, task: undefined }),
    });
  };
  useEscape(closeTask, 0, Boolean(task));
  const openTask = (id: string) => {
    void navigate({
      to: path as '/backlog' | '/today' | '/history' | '/search' | '/upcoming',
      search: (previous) => ({ ...previous, task: id }),
    });
  };
  const nav = (
    <>
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          search={{}}
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
            <div role="search" aria-label="Search tasks">
              <SearchField
                screen={path}
                query={isSearch ? (q ?? '') : ''}
                onQuery={changeQuery}
                onEscape={leaveSearch}
              />
            </div>
          </div>
          <nav aria-label="Sections">{nav}</nav>
          <Lists
            lists={lists.data?.lists ?? []}
            active={selectedIds}
            mobile={false}
            onFilter={filterList}
          />
          {lists.isError && <p role="alert">Could not load lists.</p>}
        </div>
      )}
      {!(mobile && task) && (
        <main className="main-column">
          <ScreenHeader
            mobile={mobile}
            isSearch={isSearch}
            leaveSearch={leaveSearch}
            title={title}
            isToday={isToday}
            today={today}
            upcomingCount={
              upcoming.data?.days.reduce(
                (count, day) => count + day.tasks.length,
                0,
              ) ?? 0
            }
            isBacklog={isBacklog}
            list={listFilter}
            rows={rows}
            counts={counts}
            changeQuery={changeQuery}
            path={path}
            q={q}
            search={search}
            planButton={planButton}
            openPlanner={openPlanner}
          />
          {mobile && (isBacklog || isToday) && (
            <Lists
              lists={lists.data?.lists ?? []}
              active={selectedIds}
              mobile
              onFilter={filterList}
            />
          )}
          {!isSearch && (
            <div className="filter-scope">
              <span>{listFilter ? `Showing: ${scope}` : 'All lists'}</span>
              {listFilter && (
                <Button variant="ghost" onClick={() => filterList()}>
                  Show all
                </Button>
              )}
              {listFilter && isToday && today.data && (
                <span>
                  {today.data.open.length + today.data.done.length} shown
                </span>
              )}
            </div>
          )}
          {picker.confirmation && <p role="status">{picker.confirmation}</p>}
          {completion.isError && (
            <p role="alert" className="field-error">
              {completion.error.message}
            </p>
          )}
          {path === '/upcoming' && (
            <Upcoming
              upcoming={upcoming}
              task={task}
              onOpen={openTask}
              completion={completion}
            />
          )}
          {path === '/history' && <History onOpen={openTask} />}
          {isToday && (
            <Today
              mobile={mobile}
              today={today}
              scope={scope}
              backlogCount={counts.data?.backlog ?? 0}
              onCapture={() => setCapturing(true)}
              activeList={activeList}
              planButton={planButton}
              openPlanner={openPlanner}
              rowContainer={rowContainer}
              task={task}
              list={listFilter}
              openTask={openTask}
              completion={completion}
            />
          )}
          {isSearch && q?.trim() && (
            <Search search={search} q={q} task={task} openTask={openTask} />
          )}
          {isBacklog && (
            <Backlog
              mobile={mobile}
              backlog={backlog}
              activeList={activeList}
              rowContainer={rowContainer}
              task={task}
              list={listFilter}
              openTask={openTask}
              completion={completion}
            />
          )}
        </main>
      )}
      {isToday &&
        planning &&
        !task &&
        (mobile ? (
          <BottomSheet label="Add from Backlog" onClose={closePlanner}>
            <BacklogPicker mobile={mobile} picker={picker} />
          </BottomSheet>
        ) : (
          <Popover
            anchor={planButton}
            label="Add from Backlog"
            onClose={closePlanner}
          >
            <BacklogPicker mobile={mobile} picker={picker} />
          </Popover>
        ))}
      <TaskSurface
        desktop={desktop}
        mobile={mobile}
        task={task}
        closeTask={closeTask}
        path={path}
        title={title}
      />
      {mobile && !task && (
        <>
          <nav aria-label="Sections" className="tab-bar">
            {nav}
          </nav>
          {(isBacklog || path === '/today') && (
            <Button
              className="fab"
              aria-label={isToday ? 'Add task to today' : 'Add task'}
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
            list={activeList}
            mobile
            onAdded={() => setCapturing(false)}
          />
        </BottomSheet>
      )}
    </div>
  );
}
