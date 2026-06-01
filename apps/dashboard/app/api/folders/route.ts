import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, folders, workspaceMembers, videoFolders, videos } from '@framevid/db';
import { eq, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '../../lib/auth';

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  parentFolderId: z.string().uuid().optional().nullable(),
});

async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))
    )
    .limit(1);
  return Boolean(membership);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId query param required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!(await assertWorkspaceAccess(user.id, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const folderRows = await db
      .select()
      .from(folders)
      .where(eq(folders.workspaceId, workspaceId));

    const counts = await db
      .select({
        folderId: videoFolders.folderId,
        count: sql<number>`count(*)::int`,
      })
      .from(videoFolders)
      .innerJoin(videos, eq(videos.id, videoFolders.videoId))
      .where(eq(videos.workspaceId, workspaceId))
      .groupBy(videoFolders.folderId);

    const countMap = new Map(counts.map((c) => [c.folderId, c.count]));

    return NextResponse.json({
      data: folderRows.map((f) => ({
        id: f.id,
        name: f.name,
        parentFolderId: f.parentFolderId,
        videoCount: countMap.get(f.id) ?? 0,
        createdAt: f.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error('GET folders failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { workspaceId, name, parentFolderId } = parsed.data;

    if (!(await assertWorkspaceAccess(user.id, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const [created] = await db
      .insert(folders)
      .values({
        workspaceId,
        name,
        parentFolderId: parentFolderId ?? null,
      })
      .returning();

    return NextResponse.json({
      data: { ...created, videoCount: 0 },
    });
  } catch (error: unknown) {
    console.error('POST folders failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
