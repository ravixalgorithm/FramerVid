import { redirect } from 'next/navigation';
import { db, videos, workspaces } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../lib/auth';
import VideoDetailsClient from './VideoDetailsClient';

export default async function VideoDetailsPage({
  params,
}: {
  params: { videoId: string };
}) {
  // 1. Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  const { videoId } = params;
  if (!videoId) {
    redirect('/');
  }

  // 2. Fetch the video details from database
  const matchedVideos = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  const video = matchedVideos[0];
  
  if (!video) {
    redirect('/');
  }

  // 3. Fetch workspace details
  const matchedWorkspaces = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, video.workspaceId))
    .limit(1);
  const workspace = matchedWorkspaces[0];

  return (
    <VideoDetailsClient 
      initialVideo={video}
      user={{ name: user.name, email: user.email }}
      workspace={workspace ? { id: workspace.id, name: workspace.name, plan: workspace.plan } : null}
    />
  );
}
