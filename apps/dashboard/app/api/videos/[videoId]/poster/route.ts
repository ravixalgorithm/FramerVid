import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../lib/auth';
import { localUploadPath } from '../../../../../lib/storage';
import { posterStorageKey } from '../../../../lib/asset-url';
import { uploadToR2, deleteFromR2 } from '../../../../../lib/r2';
import { invalidateVideoCache } from '../../../../../lib/cache';

const CDN_BASE =
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  'https://cdn.framevid.co';

function publicUrlForKey(key: string, origin: string): string {
  if (process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
    return `${CDN_BASE.replace(/\/$/, '')}/${key}`;
  }
  return `${origin}/api/media/${key}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { videoId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = params;
    const matched = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const video = matched[0];
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 8MB' }, { status: 400 });
    }

    const key = posterStorageKey(video.workspaceId, videoId);

    // Delete old poster before writing new one (saves storage cost)
    try { await deleteFromR2(key); } catch { /* may not exist */ }
    try { await fs.unlink(localUploadPath(key)); } catch { /* may not exist */ }

    // Upload to R2 if configured, otherwise write to local disk
    const uploadedToR2 = await uploadToR2(key, buffer, 'image/jpeg');

    if (!uploadedToR2) {
      const dest = localUploadPath(key);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, buffer);
    }

    const posterUrl = publicUrlForKey(key, req.nextUrl.origin);
    const [updated] = await db
      .update(videos)
      .set({ posterUrl, updatedAt: new Date() })
      .where(eq(videos.id, videoId))
      .returning();

    await invalidateVideoCache(videoId);
    return NextResponse.json({ data: { posterUrl, video: updated } });
  } catch (error: unknown) {
    console.error('Poster upload failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
