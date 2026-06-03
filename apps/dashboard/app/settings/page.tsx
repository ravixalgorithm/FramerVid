import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth';
import ClientProfileForm from './ClientProfileForm';

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">Profile Settings</h2>
        <p className="text-xs text-[hsl(var(--muted))]">Manage your personal profile details</p>
      </div>

      <ClientProfileForm initialName={user.name || ''} email={user.email} />
    </div>
  );
}
