import type { ReactNode } from 'react';
import { Logo } from '../brand/Logo';

type AuthShellProps = {
  title: string;
  subtitle: string;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  heroItems: string[];
  children: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  heroEyebrow,
  heroTitle,
  heroBody,
  heroItems,
  children,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <section className="auth-hero hidden w-[44%] min-w-[400px] flex-col border-r border-[hsl(var(--hairline))] px-10 py-8 lg:flex">
        <Logo />

        <div className="mt-auto max-w-md pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
            {heroEyebrow}
          </p>
          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em]">{heroTitle}</h1>
          <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted))]">{heroBody}</p>

          <ul className="mt-8 space-y-2">
            {heroItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-3 py-2.5 text-[13px] font-medium"
              >
                <span className="h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--foreground))]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-[url('/bg.jpg')] bg-cover bg-center px-4 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-black/35" aria-hidden />

        <div className="relative z-10 w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Logo variant="inverse" />
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/95 p-6 shadow-xl backdrop-blur-md sm:p-8">
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted))]">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
