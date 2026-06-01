import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../lib/auth';
import type { VideoSettings } from '@framevid/types';

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  posterUrl: z.string().optional().nullable(),
  settings: z.record(z.any()).optional(),
});

// PATCH: Update video details and player configuration
export async function PATCH(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { videoId } = params;
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    // 1. Fetch current video to verify existence and workspace association
    const matchedVideos = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const video = matchedVideos[0];
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // 2. Parse request body
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ 
        error: parsed.error.errors[0]?.message || 'Validation error', 
        code: 'VALIDATION_ERROR' 
      }, { status: 400 });
    }

    const { title, description, posterUrl, settings: newSettings } = parsed.data;

    // Merge new settings with existing settings in database
    const mergedSettings: VideoSettings = {
      ...(video.settings as any),
      ...(newSettings || {}),
    };

    // 3. Perform update in Postgres
    const [updatedVideo] = await db
      .update(videos)
      .set({
        title: title ?? video.title,
        description: description === undefined ? video.description : description,
        posterUrl: posterUrl === undefined ? video.posterUrl : posterUrl,
        settings: mergedSettings,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId))
      .returning();

    return NextResponse.json({
      data: updatedVideo,
    });

  } catch (error: any) {
    console.error('PATCH video endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// DELETE: Remove a video completely from the database
export async function DELETE(
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
      return NextResponse.json({ error: 'Video ID is required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    // 1. Verify existence
    const matchedVideos = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const video = matchedVideos[0];
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // 2. Delete the record
    await db.delete(videos).where(eq(videos.id, videoId));

    return NextResponse.json({
      data: {
        success: true,
        message: 'Video deleted successfully.',
      },
    });

  } catch (error: any) {
    console.error('DELETE video endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
