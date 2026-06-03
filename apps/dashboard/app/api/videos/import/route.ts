import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, videos, workspaces } from '@framevid/db';
import { eq, count } from 'drizzle-orm';
import { enqueueImportJob } from '@framevid/queue';
import { getCurrentUser } from '../../../lib/auth';
import { assertWorkspaceAccess } from '../../../lib/workspace-access';
import { getPlanLimits } from '../../../lib/plan-limits';
import { wakeTranscodeWorker } from '../../../lib/wake-worker';
import type { VideoSettings } from '@framevid/types';

const importSchema = z.object({
  url: z.string().url().min(1),
  workspaceId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { url, workspaceId } = parsed.data;

    if (!(await assertWorkspaceAccess(user.id, workspaceId, ['admin', 'editor']))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const planLimits = getPlanLimits(workspace.plan || 'free');

    if (planLimits.maxVideos !== null) {
      const [{ value: videoCount }] = await db
        .select({ value: count() })
        .from(videos)
        .where(eq(videos.workspaceId, workspaceId));
      if (videoCount >= planLimits.maxVideos) {
        return NextResponse.json(
          {
            error: `Video limit reached (${planLimits.maxVideos} on ${planLimits.label} plan). Upgrade to import more.`,
            code: 'PLAN_LIMIT',
          },
          { status: 403 },
        );
      }
    }

    // Create unique Video ID
    const videoId = crypto.randomUUID();

    // Default Video Settings
    const defaultSettings: VideoSettings = {
      autoplay: false,
      loop: false,
      muted: false,
      controlsStyle: 'show',
      primaryColor: '#00F0FF',
      privacy: 'public',
      downloadEnabled: false,
      playbackSpeeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
    };

    // Insert database record with a temporary title
    const [newVideo] = await db
      .insert(videos)
      .values({
        id: videoId,
        workspaceId,
        title: 'Importing Video...',
        status: 'uploading',
        originalFilename: 'import.mp4',
        settings: defaultSettings,
        thumbnailUrls: [],
      })
      .returning();

    if (!newVideo) {
      throw new Error('Database insertion returned empty record.');
    }

    await wakeTranscodeWorker();

    await enqueueImportJob({
      videoId,
      workspaceId,
      url,
    });

    return NextResponse.json({
      data: {
        video: newVideo,
        message: 'Import job queued successfully',
      },
    });

  } catch (error: any) {
    console.error('Import initiation endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
