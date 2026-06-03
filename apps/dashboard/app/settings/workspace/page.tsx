import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db, workspaces, workspaceMembers } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../lib/auth';
import ClientWorkspaceForm from './ClientWorkspaceForm';

export default async function WorkspaceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  // Retrieve joined workspaces
  const memberships = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));

  let activeWorkspace: any = null;
  let activeRole = 'admin';

  if (memberships.length > 0) {
    const cookieStore = cookies();
    const cookieWorkspaceId = cookieStore.get('framevid_workspace_id')?.value;
    
    let activeMembership = memberships[0];
    if (cookieWorkspaceId) {
      const found = memberships.find((m) => m.workspaceId === cookieWorkspaceId);
      if (found) {
        activeMembership = found;
      }
    }

    const matchedWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, activeMembership.workspaceId));
    activeWorkspace = matchedWorkspaces[0];
    activeRole = activeMembership.role;
  }

  if (!activeWorkspace) {
    redirect('/');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">Workspace Settings</h2>
        <p className="text-xs text-[hsl(var(--muted))]">Manage settings for {activeWorkspace.name}</p>
      </div>

      <ClientWorkspaceForm
        workspaceId={activeWorkspace.id}
        initialName={activeWorkspace.name}
        plan={activeWorkspace.plan || 'free'}
        role={activeRole}
      />
    </div>
  );
}
