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
    <div className="flex h-screen w-full bg-[hsl(var(--background))] font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 flex-shrink-0 bg-transparent flex flex-col justify-between overflow-y-auto">
        <div>
          <div className="h-16 flex items-center px-6 mt-2 mb-2">
            <Link href="/" className="cursor-pointer hover:opacity-85 transition-opacity">
              <Logo />
            </Link>
          </div>
          <SettingsNav />
        </div>

        <div className="px-3 pb-6">
          <Link
            href="/"
            className="w-full font-bold text-[14px] text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[#f3f4f6] rounded-[10px] px-3 py-2.5 flex items-center gap-3 transition-colors"
          >
            <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOPBAR */}
        <header className="h-[72px] flex items-center justify-end px-8 bg-transparent">
          <ProfileMenu userInitial={userInitial} userName={user.name} userEmail={user.email} />
        </header>

        <main className="flex-1 overflow-y-auto px-10 py-6">
          <div className="max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
