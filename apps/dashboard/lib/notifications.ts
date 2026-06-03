export type NotificationType = 'success' | 'error' | 'info';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  createdAt: number;
  read: boolean;
};

export const NOTIFICATIONS_STORAGE_KEY = 'framevid-notifications';
export const MAX_NOTIFICATIONS = 80;

export function createNotificationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotifications(items: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_NOTIFICATIONS))
    );
  } catch {
    // ignore quota errors
  }
}
