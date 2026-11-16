import { Link } from '@tanstack/react-router';
import { dateLabel } from './dates';
import type { RefObject } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Counts, TaskRow } from '../shared/contract';
import { api } from './api';
import { Button, CountPill, Icon } from './components';
import { SearchField } from './SearchField';
export function ScreenHeader({
  mobile,
  isSearch,
  leaveSearch,
  title,
  isToday,
  today,
  upcomingCount,
  isBacklog,
  list,
  rows,
  counts,
  changeQuery,
  path,
  q,
  search,
  planButton,
  openPlanner,
  onCapture,
}: {
  mobile: boolean;
  isSearch: boolean;
  leaveSearch: () => void;
  title: string;
  isToday: boolean;
  today: UseQueryResult<Awaited<ReturnType<typeof api.today>>>;
  upcomingCount: number;
  isBacklog: boolean;
  list?: string;
  rows?: TaskRow[];
  counts: UseQueryResult<Counts>;
  changeQuery: (value: string) => void;
  path: string;
  q?: string;
  search: UseQueryResult<Awaited<ReturnType<typeof api.search>>>;
  planButton: RefObject<HTMLButtonElement | null>;
  openPlanner: () => void;
  onCapture: () => void;
}) {
  return (
    <header className={`screen-header ${isToday ? 'today-header' : ''}`}>
      {mobile && isSearch && (
        <button className="back-link search-back" onClick={leaveSearch}>
          <Icon name="chevron-left" size={18} />
          Back
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
          {search.data.results.length}{' '}
          {search.data.results.length === 1 ? 'result' : 'results'} for "
          {q.trim()}"
        </p>
      )}
      {isBacklog && (
        <p>
          Everything you need to do someday.
          <span className="desktop-subtitle"> No date until you plan it.</span>
        </p>
      )}
      {isToday && today.data && (
        <p className="today-date">
          {dateLabel(today.data.day, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
      {mobile && isToday && (
        <Link to="/upcoming" className="upcoming-link">
          Upcoming{upcomingCount > 0 ? ` · ${upcomingCount}` : ''}
        </Link>
      )}
      {isToday && today.data && (
        <div className="today-tools">
          {(today.data.progress.total > 0 ||
            (counts.data?.backlog ?? 0) > 0) && (
            <Button ref={planButton} variant="outline" onClick={openPlanner}>
              <Icon name="backlog" size={18} />
              Add from Backlog
            </Button>
          )}
          {!mobile && (
            <Button onClick={onCapture}>
              <Icon name="plus" size={16} />
              New task
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
