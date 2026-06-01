'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to sign in');

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-[hsl(var(--background))] text-gray-950">
      <section className="hidden w-[44%] min-w-[420px] border-r border-gray-200 bg-white px-10 py-8 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-950 text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11.34-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14Z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">FrameVid</div>
            <div className="text-xs font-semibold text-gray-500">Video ops for Framer</div>
          </div>
        </div>

        <div className="mt-auto max-w-md pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">For product and agency teams</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">Publish component-ready video without slowing down delivery.</h1>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            Centralize uploads, HLS processing, Framer video IDs, and launch-ready settings in one quiet dashboard.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {['HLS streams', 'Embed IDs', 'Lead capture'].map((item) => (
              <div key={item} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-in-up">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-gray-950 text-white">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11.34-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14Z" />
              </svg>
            </div>
            <div className="text-xl font-extrabold tracking-tight">FrameVid</div>
          </div>

          <div className="dashboard-panel p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500">Manage your Framer video library and player settings.</p>
            </div>

            {error && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="alex@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-minimal h-10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-minimal h-10"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 border-t border-gray-200 pt-5 text-center text-sm text-gray-500">
              No account yet?{' '}
              <Link href="/signup" className="font-semibold text-gray-950 hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
