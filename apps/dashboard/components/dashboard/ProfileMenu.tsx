'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useNotifications } from '../notifications/NotificationProvider';

type ProfileMenuProps = {
  userInitial: string;
  userName?: string | null;
  userEmail: string;
};

export function ProfileMenu({ userInitial, userName, userEmail }: ProfileMenuProps) {
  const router = useRouter();
  const { error: notifyError } = useNotifications();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const hideMenu = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const res = await fetch('/api/auth/signout', { method: 'POST' });
      if (!res.ok) throw new Error('Sign out failed');
      router.push('/signin');
      router.refresh();
    } catch {
      notifyError('Could not sign out', { message: 'Please try again.' });
      setSigningOut(false);
    }
  };

  return (
    <div className="relative" onMouseEnter={showMenu} onMouseLeave={hideMenu}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--foreground))] text-xs font-semibold text-white shadow-[0_2px_8px_rgba(15,23,42,0.12)]"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {userInitial}
      </button>

      {open && (
        <div
          role="menu"
          className="menu-popover right-0 top-full mt-1.5 w-52 origin-top-right"
          onMouseEnter={showMenu}
          onMouseLeave={hideMenu}
        >
          <div className="border-b border-[hsl(var(--hairline))] px-2.5 py-2">
            <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{userName || 'Account'}</p>
            <p className="truncate text-[11px] text-[hsl(var(--muted))]">{userEmail}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push('/settings');
            }}
            className="menu-popover-item"
          >
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="menu-popover-item menu-popover-item-danger disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
