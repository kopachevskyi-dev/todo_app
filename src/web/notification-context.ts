import { createContext, useContext } from 'react';

export type Notification = {
  message: string;
  actions?:
    [] | [NotificationAction] | [NotificationAction, NotificationAction];
};
type NotificationAction = { label: string; onClick: () => void };

export const NotificationContext = createContext<(value: Notification) => void>(
  () => {
    throw new Error('Notifications require NotificationProvider');
  },
);
export const useNotification = () => useContext(NotificationContext);
