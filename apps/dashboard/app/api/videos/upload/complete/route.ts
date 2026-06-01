import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, videos, workspaceMembers } from '@framevid/db';
import { eq, and } from 'drizzle-orm';
import { enqueueTranscodeJob } from '@framevid/queue';
import { getCurrentUser } from '../../../../lib/auth';

const completeSchema = z.object({
  videoId: z.string().uuid(),
  rawKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { videoId, rawKey } = parsed.data;

    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const [membership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, video.workspaceId),
          eq(workspaceMembers.userId, user.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const expectedPrefix = `${video.workspaceId}/${videoId}/raw/`;
    if (!rawKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid raw key', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const originalFilename = rawKey.split('/').pop() || video.originalFilename;

    await enqueueTranscodeJob({
      videoId,
      workspaceId: video.workspaceId,
      rawKey,
      originalFilename,
    });

    await db
      .update(videos)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(videos.id, videoId));

    return NextResponse.json({
      data: {
        videoId,
        status: 'processing',
        message: 'Transcode job queued',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Upload complete endpoint failed:', error);
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
