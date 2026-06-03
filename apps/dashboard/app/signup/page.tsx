'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthShell } from '../../components/auth/AuthShell';

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to sign up');

      const redirectTo = searchParams.get('redirect') || '/';
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Start with a workspace for client sites, demos, and portfolio video."
      heroEyebrow="Launch faster"
      heroTitle="One upload. One component ID. Done."
      heroBody="Hand designers a stable embed ID and player settings—without leaving the Framer workflow."
      heroItems={['Upload and transcode', 'Configure the player', 'Paste ID in Framer']}
    >
      {error && (
        <div className="mb-5 rounded-[10px] border border-red-200/80 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[hsl(var(--muted))]">Full name</label>
          <input
            type="text"
            required
            placeholder="Alex Rivers"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-minimal h-10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[hsl(var(--muted))]">Email</label>
          <input
            type="email"
            required
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-minimal h-10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[hsl(var(--muted))]">Password</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-minimal h-10"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 border-t border-[hsl(var(--hairline))] pt-5 text-center text-sm text-[hsl(var(--muted))]">
        Already have an account?{' '}
        <Link href="/signin" className="font-medium text-[hsl(var(--foreground))] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  );
}
