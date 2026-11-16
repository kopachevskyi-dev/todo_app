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
  const navigation = mobile ? (
    <Link
      to={path as '/backlog' | '/today' | '/history' | '/search' | '/upcoming'}
      search={(previous) => ({ ...previous, task: undefined })}
      aria-label={`Back to ${title}`}
      className="detail-back"
    >
      <Icon name="chevron-left" size={16} />
      Back
    </Link>
  ) : (
    <Button variant="ghost" className="detail-back" onClick={closeTask}>
      <Icon name="chevron-left" size={16} />
      Close
    </Button>
  );
  return (
    <>
      {desktop && (
        <aside
          className={`detail-panel ${task ? 'has-task' : ''}`}
          aria-label="Task details"
        >
          <Detail
            id={task}
            onClose={closeTask}
            mobile={mobile}
            history={path === '/history'}
            navigation={navigation}
          />
        </aside>
      )}
      {!desktop && !mobile && task && (
        <Modal
          label="Task details"
          className="detail-drawer"
          onClose={closeTask}
        >
          <Detail
            id={task}
            onClose={closeTask}
            mobile={mobile}
            history={path === '/history'}
            navigation={navigation}
          />
        </Modal>
      )}
      {mobile && task && (
        <main className="pushed-detail">
          <Detail
            id={task}
            onClose={closeTask}
            mobile={mobile}
            history={path === '/history'}
            navigation={navigation}
          />
        </main>
      )}
    </>
  );
}
