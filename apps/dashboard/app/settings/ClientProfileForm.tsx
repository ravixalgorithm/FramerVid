'use client';

import { useState } from 'react';
import { useNotifications } from '@/components/notifications/NotificationProvider';

interface ProfileFormProps {
  initialName: string;
  email: string;
}

export default function ClientProfileForm({ initialName, email }: ProfileFormProps) {
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const [profileEditName, setProfileEditName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  const handleUpdateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileEditName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileEditName.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to update profile');
      
      notifySuccess('Profile updated');
      window.location.reload();
    } catch (err: any) {
      notifyError('Failed to update profile', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-[hsl(var(--foreground))]">Profile Settings</h2>
        <p className="text-[13px] text-[hsl(var(--muted))] mt-1">Manage your personal profile details</p>
      </div>

      <form onSubmit={handleUpdateProfileSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[hsl(var(--muted))] uppercase tracking-wider block">Display Name</label>
          <input
            type="text"
            required
            placeholder="Your Name"
            value={profileEditName}
            onChange={(e) => setProfileEditName(e.target.value)}
            className="w-full rounded-[12px] border-transparent bg-white px-4 py-3 text-[14px] font-medium text-[hsl(var(--foreground))] outline-none transition-colors focus:ring-2 focus:ring-[hsl(var(--accent)/0.2)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[hsl(var(--muted))] uppercase tracking-wider block">Email Address</label>
          <input
            type="email"
            disabled
            value={email}
            className="w-full rounded-[12px] border-transparent bg-white/50 px-4 py-3 text-[14px] font-medium !cursor-not-allowed text-[hsl(var(--muted))]"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !profileEditName.trim() || profileEditName.trim() === initialName}
            className="bg-black text-white hover:bg-black/90 rounded-[12px] h-10 px-6 text-[14px] font-bold disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
