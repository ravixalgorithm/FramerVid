import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db, workspaces, workspaceMembers } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../lib/auth';
import TeamSettingsClient from './TeamSettingsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team & Members - FrameVid',
};

export default async function TeamSettingsPage() {
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
  }

  if (!activeWorkspace) {
    redirect('/');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Team & Members</h2>
        <p className="text-sm text-gray-400 mt-1">
          Manage workspace members and pending invitations for {activeWorkspace.name}.
        </p>
      </div>

      <TeamSettingsClient workspaceId={activeWorkspace.id} />
    </div>
  );
}
