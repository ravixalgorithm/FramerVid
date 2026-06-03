'use client';

import type { ReactNode } from 'react';
import { NotificationProvider } from './notifications/NotificationProvider';

export function Providers({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}
