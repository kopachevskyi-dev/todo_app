import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NotificationContext, type Notification } from './notification-context';
import { Button } from './components';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification>();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const show = useCallback((value: Notification) => setNotification(value), []);
  useEffect(() => {
    if (!notification || hovered || focused) return;
    const timer = setTimeout(() => setNotification(undefined), 6000);
    return () => clearTimeout(timer);
  }, [notification, hovered, focused]);

  return (
    <NotificationContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={notification ? 'notification' : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
      >
        {notification && (
          <>
            <span>{notification.message}</span>
            {notification.actions?.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                onClick={() => {
                  setNotification(undefined);
                  setHovered(false);
                  setFocused(false);
                  action.onClick();
                }}
              >
                {action.label}
              </Button>
            ))}
          </>
        )}
      </div>
    </NotificationContext.Provider>
  );
}
