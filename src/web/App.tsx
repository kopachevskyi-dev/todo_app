import { useBacklogPicker } from './useBacklogPicker';
import { useEscape } from './useEscape';
import { queryKeys } from './query-keys';
import { useRollover } from './useRollover';
import { TaskSurface } from './TaskSurface';
import { ScreenHeader } from './ScreenHeader';
import { Search } from './Search';
import { Today } from './Today';
import { TodayHero } from './TodayHero';
import { TodayWidgets } from './TodayWidgets';
import { Backlog } from './Backlog';
import { BacklogPicker } from './BacklogPicker';
import { SearchField } from './SearchField';
import { Capture } from './Capture';
import type { CaptureDraft } from './useCreateTask';
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
import { BottomSheet, Button, Icon, Modal, Popover } from './components';
import { ListFilters } from './Lists';
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
  { to: '/today', label: 'Today' },
  { to: '/backlog', label: 'Backlog' },
  { to: '/upcoming', label: 'Upcoming' },
  { to: '/history', label: 'History' },
] as const;

export function App() {
  useRollover();
  const location = useLocation();
  const path = location.pathname;
  const router = useRouter();
  const { task, lists: listFilter, q, from } = useSearch({ strict: false });
  const navigate = useNavigate();
  const mobile = useMedia('(max-width: 767px)');
  const desktop = useMedia('(min-width: 1100px)');
  const [capturing, setCapturing] = useState(false);
  const [captureDrafts, setCaptureDrafts] = useState<
    Record<'backlog' | 'today', CaptureDraft>
  >({
    backlog: { title: '' },
    today: { title: '' },
  });
  const picker = useBacklogPicker(path === '/today');
  const { planning, closePlanner } = picker;
  const openPlanner = () => picker.openPlanner();
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
  const title = tabs.find((tab) => tab.to === path)?.label ?? 'Search';
  // Pending UI comes from the mutation, so focus refetches cannot erase it.
  const pendingCreates = useMutationState({
    filters: { mutationKey: createTaskMutationKey, status: 'pending' },
    select: (mutation) =>
      mutation.state.context as CreateTaskContext | undefined,
  }).filter((context) => context !== undefined);
  const pendingBacklog = pendingCreates.filter(
    ({ request }) => request.target === 'backlog',
  );
  const lists = useQuery({ queryKey: queryKeys.lists, queryFn: api.lists });
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
    select: (data) => {
      const allTasks = [
        ...pendingBacklog
          .slice()
          .reverse()
          .map(({ row }) => row),
        ...data.tasks,
      ];
      return { tasks: allTasks.filter(matchesList), allTasks };
    },
  });
  const today = useQuery({
    queryKey: queryKeys.todayList(),
    queryFn: () => api.today(),
    enabled: isToday,
    select: (data) => ({
      ...data,
      allTasks: [...data.open, ...data.done],
      open: data.open.filter(matchesList),
      done: data.done.filter(matchesList),
    }),
  });
  const pendingToday = pendingCreates.filter(
    ({ request }) =>
      request.target === 'today' &&
      (!request.day || request.day === today.data?.day),
  ).length;
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
  const upcoming = useQuery({
    queryKey: queryKeys.upcoming,
    queryFn: api.upcoming,
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
          <span className="nav-label">{tab.label}</span>
        </Link>
      ))}
    </>
  );
  return (
    <div className={`app-shell ${mobile && task ? 'task-pushed' : ''}`}>
      {!mobile && (
        <header className="top-bar">
          <div className="app-brand">
            <span className="app-logo">
              <Icon name="check" size={16} />
            </span>
            <span className="app-name">Tasks</span>
          </div>
          <nav aria-label="Sections" className="nav-pill">
            {tabs.map((tab) => {
              const count =
                tab.to === '/today'
                  ? counts.data?.todayOpen
                  : tab.to === '/backlog'
                    ? counts.data?.backlog
                    : tab.to === '/upcoming'
                      ? upcoming.data?.days.reduce(
                          (sum, day) => sum + day.tasks.length,
                          0,
                        )
                      : undefined;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  search={{}}
                  aria-current={path === tab.to ? 'page' : undefined}
                  className="nav-link"
                >
                  <span className="nav-label">{tab.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="nav-count"> {count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div role="search" aria-label="Search tasks" className="top-search">
            <SearchField
              screen={path}
              query={isSearch ? (q ?? '') : ''}
              onQuery={changeQuery}
              onEscape={leaveSearch}
            />
          </div>
        </header>
      )}
      {!(mobile && task) && (
        <div className="content-grid">
          <main
            className={`main-column ${isToday && !(desktop && task) ? 'today-main' : ''}`}
          >
            <ScreenHeader
              mobile={mobile}
              isSearch={isSearch}
              leaveSearch={leaveSearch}
              title={title}
              isToday={isToday}
              today={today}
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
              onCapture={() => setCapturing(true)}
            />
            <div
              className={
                isToday
                  ? `today-body ${desktop && task ? 'task-open' : ''}`
                  : undefined
              }
            >
              <div className={isToday ? 'today-primary' : undefined}>
                {isToday && !mobile && !listFilter && (
                  <TodayHero
                    task={today.data?.open[0]}
                    onOpen={openTask}
                    onComplete={(id) =>
                      completion.mutate({ id, completed: true })
                    }
                    pending={completion.isPending}
                  />
                )}
                <section
                  className={mobile ? 'screen-content' : 'list-card'}
                  aria-label="Tasks"
                >
                  {(!mobile || isToday) && path !== '/history' && (
                    <div className="list-card-heading">
                      <h2 className="list-card-title">
                        {isToday
                          ? 'Today’s plan'
                          : isBacklog
                            ? 'All tasks'
                            : isSearch
                              ? 'Results'
                              : 'Next days'}
                      </h2>
                      {isToday && today.data && (
                        <span className="row-meta">
                          {today.data.progress.done} of{' '}
                          {today.data.progress.total} done
                        </span>
                      )}
                    </div>
                  )}
                  {path !== '/history' && (!mobile || isBacklog || isToday) && (
                    <ListFilters
                      lists={lists.data?.lists ?? []}
                      active={selectedIds}
                      mobile={mobile}
                      onFilter={filterList}
                      tasks={
                        isToday
                          ? (today.data?.allTasks ?? [])
                          : isBacklog
                            ? (backlog.data?.allTasks ?? [])
                            : isSearch
                              ? (search.data?.results ?? [])
                              : (upcoming.data?.days.flatMap(
                                  (day) => day.tasks,
                                ) ?? [])
                      }
                    />
                  )}
                  {lists.isError && <p role="alert">Could not load lists.</p>}
                  {(isBacklog ||
                    isToday ||
                    path === '/history' ||
                    path === '/upcoming' ||
                    isSearch) && (
                    <div className="filter-scope">
                      <span>
                        {listFilter ? `Showing: ${scope}` : 'All lists'}
                      </span>
                      {listFilter && (
                        <Button variant="ghost" onClick={() => filterList()}>
                          Show all
                        </Button>
                      )}
                      {listFilter && isToday && today.data && (
                        <span>
                          {today.data.open.length + today.data.done.length}{' '}
                          shown
                        </span>
                      )}
                    </div>
                  )}
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
                      list={listFilter}
                    />
                  )}
                  {path === '/history' && (
                    <History
                      onOpen={openTask}
                      mobile={mobile}
                      onFilter={filterList}
                    />
                  )}
                  {isToday && (
                    <Today
                      mobile={mobile}
                      today={today}
                      scope={scope}
                      backlogCount={counts.data?.backlog ?? 0}
                      onCapture={() => setCapturing(true)}
                      rowContainer={rowContainer}
                      task={task}
                      list={listFilter}
                      openTask={openTask}
                      completion={completion}
                    />
                  )}
                  {isSearch && q?.trim() && (
                    <Search
                      search={search}
                      q={q}
                      task={task}
                      openTask={openTask}
                      list={listFilter}
                    />
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
                </section>
              </div>
              {isToday && !(desktop && task) && (
                <TodayWidgets
                  progress={today.data?.progress}
                  day={today.data?.day}
                  list={activeList}
                  filteredIds={selectedIds}
                  picker={picker}
                />
              )}
            </div>
          </main>
          {!mobile && (!isToday || task) && (
            <TaskSurface
              desktop={desktop}
              mobile={mobile}
              task={task}
              closeTask={closeTask}
              path={path}
              title={title}
            />
          )}
        </div>
      )}
      {mobile && (
        <TaskSurface
          desktop={desktop}
          mobile={mobile}
          task={task}
          closeTask={closeTask}
          path={path}
          title={title}
        />
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
              <Icon name="plus" size={22} />
            </Button>
          )}
        </>
      )}
      {capturing && !mobile && isToday && (
        <Modal label="New task" onClose={() => setCapturing(false)}>
          <h3>New task</h3>
          <Capture
            target="today"
            list={activeList}
            draft={captureDrafts.today}
            onDraftChange={(draft) =>
              setCaptureDrafts((current) => ({ ...current, today: draft }))
            }
            onAdded={() => setCapturing(false)}
            onClose={() => setCapturing(false)}
          />
        </Modal>
      )}
      {capturing && mobile && !task && (
        <BottomSheet label="New task" onClose={() => setCapturing(false)}>
          <h3 className="sheet-label">New task</h3>
          <Capture
            target={isBacklog ? 'backlog' : 'today'}
            list={activeList}
            mobile
            draft={captureDrafts[isBacklog ? 'backlog' : 'today']}
            onDraftChange={(draft) =>
              setCaptureDrafts((current) => ({
                ...current,
                [isBacklog ? 'backlog' : 'today']: draft,
              }))
            }
            onAdded={() => setCapturing(false)}
            onClose={() => setCapturing(false)}
          />
        </BottomSheet>
      )}
    </div>
  );
}
