import { NextRequest, NextResponse } from 'next/server';
import { db, videos, workspaces, videoFolders } from '@framevid/db';
import { eq, count } from 'drizzle-orm';
import { getCurrentUser } from '../../../../lib/auth';
import { assertWorkspaceAccess } from '../../../../lib/workspace-access';
import { getPlanLimits } from '../../../../lib/plan-limits';

export async function POST(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { videoId } = params;
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    // Fetch original video record
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify workspace access (need admin or editor to duplicate assets)
    if (!(await assertWorkspaceAccess(user.id, video.workspaceId, ['admin', 'editor']))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, video.workspaceId)).limit(1);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Check workspace limits on video count
    const planLimits = getPlanLimits(workspace.plan || 'free');
    if (planLimits.maxVideos !== null) {
      const [{ value: videoCount }] = await db
        .select({ value: count() })
        .from(videos)
        .where(eq(videos.workspaceId, video.workspaceId));
      if (videoCount >= planLimits.maxVideos) {
        return NextResponse.json(
          {
            error: `Video limit reached (${planLimits.maxVideos} on ${planLimits.label} plan). Upgrade to duplicate videos.`,
            code: 'PLAN_LIMIT',
          },
          { status: 403 },
        );
      }
    }

    const newVideoId = crypto.randomUUID();

    // Insert duplicated video record in DB
    const [duplicatedVideo] = await db
      .insert(videos)
      .values({
        id: newVideoId,
        workspaceId: video.workspaceId,
        title: `${video.title} (Copy)`,
        description: video.description,
        status: video.status,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
        originalFilename: video.originalFilename,
        hlsManifestUrl: video.hlsManifestUrl,
        thumbnailUrls: video.thumbnailUrls,
        posterUrl: video.posterUrl,
        captionsUrl: video.captionsUrl,
        aiInsights: video.aiInsights,
        audioExtracted: video.audioExtracted,
        settings: video.settings, // Preserves player styling, CTA, forms, colors, etc.
      })
      .returning();

    if (!duplicatedVideo) {
      throw new Error('Duplication failed during database insertion.');
    }

    // Replicate folder associations if original video was inside a folder
    const [folderAssoc] = await db
      .select()
      .from(videoFolders)
      .where(eq(videoFolders.videoId, videoId))
      .limit(1);

    if (folderAssoc) {
      await db.insert(videoFolders).values({
        videoId: newVideoId,
        folderId: folderAssoc.folderId,
      });
    }

    return NextResponse.json({
      data: duplicatedVideo,
    });

  } catch (error: any) {
    console.error('Video duplication failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
