import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, folders, videoFolders, videos } from '@framevid/db';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentUser } from '../../../lib/auth';
import { assertWorkspaceAccess } from '../../../lib/workspace-access';

const moveSchema = z.object({
  videoIds: z.array(z.string().uuid()),
  folderId: z.string().uuid().nullable().optional(), // Nullable to allow removing from folders
});


export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = moveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { videoIds, folderId } = parsed.data;
    if (videoIds.length === 0) {
      return NextResponse.json({ data: { success: true } });
    }

    // 1. Fetch videos to verify access
    const matchedVideos = await db.select().from(videos).where(inArray(videos.id, videoIds));
    if (matchedVideos.length === 0) {
      return NextResponse.json({ error: 'No videos found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Ensure all videos belong to the same workspace and user has access
    const workspaceId = matchedVideos[0].workspaceId;
    const sameWorkspace = matchedVideos.every((v) => v.workspaceId === workspaceId);
    if (!sameWorkspace) {
      return NextResponse.json({ error: 'Videos belong to different workspaces', code: 'FORBIDDEN' }, { status: 400 });
    }

    if (!(await assertWorkspaceAccess(user.id, workspaceId, ['admin', 'editor']))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    // 2. If folderId is provided, verify it belongs to the same workspace
    if (folderId) {
      const [matchedFolder] = await db.select().from(folders).where(eq(folders.id, folderId)).limit(1);
      if (!matchedFolder) {
        return NextResponse.json({ error: 'Folder not found', code: 'NOT_FOUND' }, { status: 404 });
      }
      if (matchedFolder.workspaceId !== workspaceId) {
        return NextResponse.json({ error: 'Folder does not belong to workspace', code: 'FORBIDDEN' }, { status: 403 });
      }
    }

    // 3. Perform move operation
    // First, clear existing folder associations for these videos
    await db.delete(videoFolders).where(inArray(videoFolders.videoId, videoIds));

    // If target folder is provided, insert new associations
    if (folderId) {
      const insertValues = videoIds.map((vId) => ({
        videoId: vId,
        folderId: folderId,
      }));
      await db.insert(videoFolders).values(insertValues);
    }

    return NextResponse.json({
      data: {
        success: true,
        message: folderId ? 'Videos moved to folder successfully.' : 'Videos removed from folders successfully.',
      },
    });
  } catch (error: unknown) {
    console.error('Move videos failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
