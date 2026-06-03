import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db, workspaces, videos, workspaceMembers, videoFolders } from '@framevid/db';
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

  const videoRows = await db
    .select({
      video: videos,
      folderId: videoFolders.folderId,
    })
    .from(videos)
    .leftJoin(videoFolders, eq(videos.id, videoFolders.videoId))
    .where(eq(videos.workspaceId, activeWorkspace.id));

  const videoList = videoRows.map((row) => ({
    ...row.video,
    folderId: row.folderId || null,
  }));

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
