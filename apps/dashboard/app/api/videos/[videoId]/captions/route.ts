import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../lib/auth';
import { captionsStorageKey, storedMediaUrl } from '../../../../lib/asset-url';
import { normalizeCaptionsFile } from '../../../../lib/captions';
import { localUploadPath } from '../../../../../lib/storage';
import { uploadToR2, deleteFromR2 } from '../../../../../lib/r2';
import { invalidateVideoCache } from '../../../../../lib/cache';

const MAX_CAPTION_BYTES = 512 * 1024;

function isCaptionFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.vtt') || lower.endsWith('.srt');
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

    const filename =
      file instanceof File && file.name ? file.name : 'captions.vtt';

    if (!isCaptionFile(filename)) {
      return NextResponse.json(
        { error: 'Only .vtt or .srt caption files are supported.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_CAPTION_BYTES) {
      return NextResponse.json(
        { error: 'Caption file must be under 512KB.' },
        { status: 400 },
      );
    }

    let vttText: string;
    try {
      vttText = normalizeCaptionsFile(buffer.toString('utf8'), filename);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid caption file';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const key = captionsStorageKey(video.workspaceId, videoId);

    // Delete old caption before writing new one (saves storage cost)
    try { await deleteFromR2(key); } catch { /* may not exist */ }
    try { await fs.unlink(localUploadPath(key)); } catch { /* may not exist */ }

    // Upload to R2 if configured, otherwise write to local disk
    const uploadedToR2 = await uploadToR2(key, vttText, 'text/vtt');

    if (!uploadedToR2) {
      const dest = localUploadPath(key);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, vttText, 'utf8');
    }

    const captionsUrl = storedMediaUrl(key, req.nextUrl.origin);
    const [updated] = await db
      .update(videos)
      .set({ captionsUrl, updatedAt: new Date() })
      .where(eq(videos.id, videoId))
      .returning();

    await invalidateVideoCache(videoId);
    return NextResponse.json({ data: { captionsUrl, video: updated } });
  } catch (error: unknown) {
    console.error('Captions upload failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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

    const key = captionsStorageKey(video.workspaceId, videoId);
    // Delete from R2
    try { await deleteFromR2(key); } catch { /* may not exist */ }
    // Delete from local disk
    try { await fs.unlink(localUploadPath(key)); } catch { /* may not exist */ }

    const [updated] = await db
      .update(videos)
      .set({ captionsUrl: null, updatedAt: new Date() })
      .where(eq(videos.id, videoId))
      .returning();

    await invalidateVideoCache(videoId);
    return NextResponse.json({ data: { video: updated } });
  } catch (error: unknown) {
    console.error('Captions delete failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
