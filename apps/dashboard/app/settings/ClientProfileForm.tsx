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
    <form onSubmit={handleUpdateProfileSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <label className="section-label block">Display Name</label>
        <input
          type="text"
          required
          placeholder="Your Name"
          value={profileEditName}
          onChange={(e) => setProfileEditName(e.target.value)}
          className="detail-field"
        />
      </div>

      <div className="space-y-1.5">
        <label className="section-label block">Email Address</label>
        <input
          type="email"
          disabled
          value={email}
          className="detail-field !cursor-not-allowed !bg-[hsl(var(--sidebar))] !text-[hsl(var(--muted))]"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading || !profileEditName.trim() || profileEditName.trim() === initialName}
          className="btn-accent rounded-lg h-8 px-4 text-xs font-bold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
