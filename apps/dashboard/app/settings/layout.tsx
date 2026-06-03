import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '../lib/auth';
import { Logo } from '../../components/brand/Logo';
import { ProfileMenu } from '../../components/dashboard/ProfileMenu';
import SettingsNav from './SettingsNav';

interface LayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({ children }: LayoutProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  const userInitial = (user.name || user.email)[0].toUpperCase();

  return (
    <div className="dash-shell font-sans">
      {/* TOP HEADER */}
      <header className="dash-topbar !h-[52px]">
        <div className="flex items-center gap-4">
          <Link href="/" className="cursor-pointer hover:opacity-85">
            <Logo />
          </Link>
          <span className="h-4 w-[1px] bg-[hsl(var(--hairline))]" />
          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <ProfileMenu userInitial={userInitial} userName={user.name} userEmail={user.email} />
      </header>

      {/* SETTINGS CONTAINER */}
      <div className="flex flex-1 flex-col md:flex-row max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 gap-8">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full flex-shrink-0 md:w-60 md:min-w-[15rem] md:max-w-[15rem]">
          <SettingsNav />
        </aside>

        {/* CONTENT PANEL */}
        <main className="dashboard-panel min-w-0 flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
