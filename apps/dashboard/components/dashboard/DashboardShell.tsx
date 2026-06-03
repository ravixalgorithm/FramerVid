'use client';

import type { ReactNode } from 'react';

type DashboardShellProps = {
  children: ReactNode;
};

/** Full-width dashboard layout — no sidebar. */
export function DashboardShell({ children }: DashboardShellProps) {
  return <div className="dash-shell">{children}</div>;
}
