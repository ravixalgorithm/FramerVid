import { redirect } from 'next/navigation';
import { db, workspaces, videos, workspaceMembers } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from './lib/auth';
import VideoDashboardClient from './VideoDashboardClient';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  const memberships = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));

  let activeWorkspace: any = null;

  if (memberships.length > 0) {
    const matchedWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, memberships[0].workspaceId));
    activeWorkspace = matchedWorkspaces[0];
  } else {
    const workspaceSlug = `default-workspace-${Math.random().toString(36).substring(2, 6)}`;
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name: `${user.name || user.email.split('@')[0]}'s Workspace`,
        slug: workspaceSlug,
        ownerId: user.id,
        plan: 'free',
      })
      .returning();

    if (newWorkspace) {
      await db.insert(workspaceMembers).values({
        workspaceId: newWorkspace.id,
        userId: user.id,
        role: 'admin',
      });
      activeWorkspace = newWorkspace;
    }
  }

  if (!activeWorkspace) {
    throw new Error('Could not establish an active workspace for user');
  }

  const videoList = await db
    .select()
    .from(videos)
    .where(eq(videos.workspaceId, activeWorkspace.id));

  return (
    <VideoDashboardClient
      initialVideos={videoList}
      workspaceId={activeWorkspace.id}
      user={{ name: user.name, email: user.email }}
      activeWorkspace={{
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        plan: activeWorkspace.plan || 'free',
      }}
    />
  );
}
