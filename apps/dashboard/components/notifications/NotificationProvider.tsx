'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type AppNotification,
  type NotificationType,
  createNotificationId,
  NOTIFICATIONS_STORAGE_KEY,
  loadNotifications,
  saveNotifications,
} from '../../lib/notifications';
import { ToastViewport } from './ToastViewport';

export type NotifyOptions = {
  message?: string;
  duration?: number;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (type: NotificationType, title: string, options?: NotifyOptions) => void;
  success: (title: string, options?: NotifyOptions) => void;
  error: (title: string, options?: NotifyOptions) => void;
  info: (title: string, options?: NotifyOptions) => void;
  markAllRead: () => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
  activeToasts: AppNotification[];
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATION: Record<NotificationType, number> = {
  success: 3200,
  error: 5200,
  info: 4000,
};

type ToastTimer = {
  timeoutId: number;
  remaining: number;
  start: number;
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const toastTimersRef = useRef<Map<string, ToastTimer>>(new Map());

  useEffect(() => {
    setNotifications(loadNotifications());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveNotifications(notifications);
  }, [notifications, hydrated]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === NOTIFICATIONS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as AppNotification[];
          if (Array.isArray(parsed)) setNotifications(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer.timeoutId);
      toastTimersRef.current.delete(id);
    }
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleToastDismiss = useCallback(
    (id: string, duration: number) => {
      const start = Date.now();
      const timeoutId = window.setTimeout(() => dismissToast(id), duration);
      toastTimersRef.current.set(id, { timeoutId, remaining: duration, start });
    },
    [dismissToast]
  );

  const pauseToastTimers = useCallback(() => {
    toastTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer.timeoutId);
      timer.remaining -= Date.now() - timer.start;
    });
  }, []);

  const resumeToastTimers = useCallback(() => {
    toastTimersRef.current.forEach((timer, id) => {
      timer.start = Date.now();
      timer.timeoutId = window.setTimeout(() => dismissToast(id), timer.remaining);
    });
  }, [dismissToast]);

  const notify = useCallback(
    (type: NotificationType, title: string, options?: NotifyOptions) => {
      const entry: AppNotification = {
        id: createNotificationId(),
        type,
        title,
        message: options?.message,
        createdAt: Date.now(),
        read: false,
      };

      setNotifications((prev) => [entry, ...prev]);
      setActiveToasts((prev) => [...prev, entry]);

      const duration = options?.duration ?? DEFAULT_DURATION[type];
      scheduleToastDismiss(entry.id, duration);
    },
    [dismissToast, scheduleToastDismiss]
  );

  const success = useCallback(
    (title: string, options?: NotifyOptions) => notify('success', title, options),
    [notify]
  );

  const error = useCallback(
    (title: string, options?: NotifyOptions) => notify('error', title, options),
    [notify]
  );

  const info = useCallback(
    (title: string, options?: NotifyOptions) => notify('info', title, options),
    [notify]
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    toastTimersRef.current.forEach((timer) => window.clearTimeout(timer.timeoutId));
    toastTimersRef.current.clear();
    setNotifications([]);
    setActiveToasts([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      notify,
      success,
      error,
      info,
      markAllRead,
      clearAll,
      dismissToast,
      activeToasts,
    }),
    [
      notifications,
      unreadCount,
      notify,
      success,
      error,
      info,
      markAllRead,
      clearAll,
      dismissToast,
      activeToasts,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={activeToasts}
        onDismiss={dismissToast}
        onPauseTimers={pauseToastTimers}
        onResumeTimers={resumeToastTimers}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}
