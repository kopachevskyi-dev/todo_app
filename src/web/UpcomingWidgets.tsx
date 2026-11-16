import type { z } from 'zod';
import type { List, upcomingResponseSchema } from '../shared/contract';
import { ByListWidget } from './ByListWidget';
import { thisWeekWidget } from './progress';
import { StatWidget } from './StatWidget';

export function UpcomingWidgets({
  upcoming,
  lists,
  onFilter,
}: {
  upcoming: z.infer<typeof upcomingResponseSchema>;
  lists: List[];
  onFilter: (id: string) => void;
}) {
  const tasks = upcoming.days.flatMap(({ day, tasks }) =>
    tasks.map((task) => ({ ...task, day })),
  );
  const stat = thisWeekWidget(tasks, upcoming.today);
  return (
    <div className="today-widgets upcoming-widgets">
      <StatWidget title="This week" {...stat} />
      <ByListWidget lists={lists} tasks={tasks} onFilter={onFilter} />
    </div>
  );
}
