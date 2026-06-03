import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../lib/auth';
import { localUploadPath } from '../../../../../lib/storage';
import { logoStorageKey } from '../../../../lib/asset-url';

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
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
    }

    let ext = '.png';
    if (file.type === 'image/jpeg') ext = '.jpg';
    if (file.type === 'image/webp') ext = '.webp';
    if (file.type === 'image/svg+xml') ext = '.svg';

    const key = logoStorageKey(video.workspaceId, videoId, ext);
    const dest = localUploadPath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);

    const logoUrl = publicUrlForKey(key, req.nextUrl.origin);
    
    // Update settings jsonb
    const newSettings = {
      ...(video.settings as any),
      brandingLogoUrl: logoUrl,
    };

    const [updated] = await db
      .update(videos)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(videos.id, videoId))
      .returning();

    return NextResponse.json({ data: { brandingLogoUrl: logoUrl, video: updated } });
  } catch (error: unknown) {
    console.error('Logo upload failed:', error);
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

    const newSettings = { ...(video.settings as any) };
    delete newSettings.brandingLogoUrl;

    const [updated] = await db
      .update(videos)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(videos.id, videoId))
      .returning();

    return NextResponse.json({ data: { video: updated } });
  } catch (error: unknown) {
    console.error('Logo deletion failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
