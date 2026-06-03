import { NextResponse } from 'next/server';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../../lib/auth';
import { assertWorkspaceAccess } from '../../../../../lib/workspace-access';
import { getRetentionSeries } from '../../../../../lib/analytics-queries';
import { generateFrictionAnalysis } from '../../../../../lib/friction-analysis';

export async function POST(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const videoId = params.videoId;
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const membership = await assertWorkspaceAccess(user.id, video.workspaceId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const retention = await getRetentionSeries(
      videoId,
      video.durationSeconds ? Number(video.durationSeconds) : undefined
    );

    const friction = await generateFrictionAnalysis(videoId, retention);

    if (!friction) {
      return NextResponse.json({ error: 'No friction cliff detected' }, { status: 400 });
    }

    return NextResponse.json({ data: friction });
  } catch (error: unknown) {
    console.error('Failed to generate friction analysis:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
