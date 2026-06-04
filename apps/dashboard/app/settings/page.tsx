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


      <ClientProfileForm initialName={user.name || ''} email={user.email} />
    </div>
  );
}
