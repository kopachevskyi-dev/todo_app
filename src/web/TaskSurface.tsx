import { Link } from '@tanstack/react-router';
import { Detail } from './Detail';
import { Button, Icon, Modal } from './components';
export function TaskSurface({
  desktop,
  mobile,
  task,
  closeTask,
  path,
  title,
}: {
  desktop: boolean;
  mobile: boolean;
  task?: string;
  closeTask: () => void;
  path: string;
  title: string;
}) {
  return (
    <>
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
          <Detail
            id={task}
            onClose={closeTask}
            mobile={mobile}
            history={path === '/history'}
          />
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
          <Detail
            id={task}
            onClose={closeTask}
            mobile={mobile}
            history={path === '/history'}
          />
        </Modal>
      )}
      {mobile && task && (
        <main className="pushed-detail">
          <Link
            to={path as '/backlog' | '/today' | '/history' | '/search'}
            search={(previous) => ({ ...previous, task: undefined })}
            aria-label={`Back to ${title}`}
            className="back-link"
          >
            ‹ {title}
          </Link>
          <Detail
            id={task}
            onClose={closeTask}
            mobile={mobile}
            history={path === '/history'}
          />
        </main>
      )}
    </>
  );
}
