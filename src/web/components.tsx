import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import type { TaskRow as TaskRowData } from '../shared/contract';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    backlog: (
      <>
        <path d="m12 4 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
      </>
    ),
    today: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    error: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16v1" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'plus' ? 2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'strong' | 'icon' | 'ghost';
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    />
  );
}
export function CountPill({ children }: { children: ReactNode }) {
  return <span className="count-pill">{children}</span>;
}
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}
export function EmptyPanel({ children }: { children: ReactNode }) {
  return <p className="empty-panel">{children}</p>;
}
export function Checkbox({
  checked = false,
  label,
}: {
  checked?: boolean;
  label: string;
}) {
  return (
    <span
      className="check-hit"
      role="checkbox"
      aria-checked={checked}
      aria-disabled="true"
      aria-label={label}
    >
      <span className={`checkbox ${checked ? 'checked' : ''}`}>
        {checked && <Icon name="check" size={14} />}
      </span>
    </span>
  );
}
export function TaskRow({
  task,
  selected,
  href,
  onOpen,
}: {
  task: TaskRowData;
  selected: boolean;
  href: string;
  onOpen: () => void;
}) {
  return (
    <li
      data-layout-id={task.id}
      className={`task-row ${selected ? 'selected' : ''}`}
    >
      <a
        href={href}
        onClick={(event) => {
          if (
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault();
            onOpen();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const row = event.currentTarget.parentElement;
            const next =
              event.key === 'ArrowDown'
                ? row?.nextElementSibling
                : row?.previousElementSibling;
            next?.querySelector('a')?.focus();
          }
        }}
        aria-current={selected ? 'true' : undefined}
      >
        <Checkbox
          label={`Completion of ${task.title}`}
          checked={Boolean(task.completedAt)}
        />
        <span className="row-text">
          <span className="row-title">{task.title}</span>
          {task.list && (
            <span className="row-meta">
              <span
                className="list-dot"
                style={{ background: task.list.color }}
              />
              {task.list.name}
            </span>
          )}
        </span>
        <Icon name="chevron" size={18} />
      </a>
    </li>
  );
}

export function QuickAdd({
  value,
  onChange,
  onSubmit,
  error,
  pending,
  mobile = false,
  target = 'backlog',
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error?: string;
  pending: boolean;
  mobile?: boolean;
  target?: 'backlog' | 'today';
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  return (
    <form
      className={`quick-add ${mobile ? 'capture-add' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="quick-field">
        <Icon name="plus" />
        <input
          ref={inputRef}
          aria-label="Task title"
          aria-describedby={id}
          aria-invalid={Boolean(error)}
          placeholder={`Add to ${target}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {!mobile && (
          <Button type="submit" disabled={pending}>
            Add <span className="key-chip">Enter</span>
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          <Icon name="error" size={16} />
          {error}
        </p>
      )}
      <div className="capture-footer">
        <p id={id} className="field-hint">
          {mobile
            ? 'A title is enough. Add details later.'
            : 'A title is enough. Add details, a list or a day later.'}
        </p>
        {mobile && (
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        )}
      </div>
    </form>
  );
}

export function Modal({
  label,
  className = '',
  onClose,
  children,
  sheet = false,
}: {
  label: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  sheet?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startY = useRef<number | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    const viewport = window.visualViewport;
    const adjustKeyboard = () => {
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      element.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    adjustKeyboard();
    viewport?.addEventListener('resize', adjustKeyboard);
    viewport?.addEventListener('scroll', adjustKeyboard);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      viewport?.removeEventListener('resize', adjustKeyboard);
      viewport?.removeEventListener('scroll', adjustKeyboard);
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={label}
      aria-modal="true"
      className={`modal ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="scrim" data-testid="scrim" onClick={onClose} />
      <section
        className="modal-content"
        onTouchStart={(event) => {
          startY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          if (
            sheet &&
            startY.current !== null &&
            (event.changedTouches[0]?.clientY ?? 0) - startY.current > 80
          )
            onClose();
          startY.current = null;
        }}
      >
        {sheet && <div className="sheet-handle" aria-hidden="true" />}
        {children}
      </section>
    </dialog>
  );
}

export function BottomSheet(props: Omit<Parameters<typeof Modal>[0], 'sheet'>) {
  return (
    <Modal
      {...props}
      sheet
      className={`bottom-sheet ${props.className ?? ''}`}
    />
  );
}
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal label={title} className="confirm-dialog" onClose={onClose}>
      <h3>{title}</h3>
      <div>{children}</div>
      <div className="dialog-actions">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
export function Popover({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const rect = anchor.current?.getBoundingClientRect();
    if (rect) {
      element.style.left = `${Math.min(rect.left, window.innerWidth - 316)}px`;
      element.style.top = `${rect.bottom + 8}px`;
    }
    element.focus();
    const outside = (event: PointerEvent) => {
      if (
        !element.contains(event.target as Node) &&
        !anchor.current?.contains(event.target as Node)
      )
        onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      previous?.focus();
    };
  }, [anchor, onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className="popover"
    >
      {children}
    </div>
  );
}
