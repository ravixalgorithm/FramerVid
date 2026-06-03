import { NextRequest, NextResponse } from 'next/server';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { resolveMediaUrl } from '../../../../lib/asset-url';
import { getCurrentUser } from '../../../../lib/auth';
import { assertWorkspaceAccess } from '../../../../lib/workspace-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = params;
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!(await assertWorkspaceAccess(user.id, video.workspaceId, ['admin', 'editor', 'viewer']))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cleanFilename = (video.originalFilename || 'video.mp4').replace(/[^a-zA-Z0-9.]/g, '_');
    
    const possibleKeys = [
      `${video.workspaceId}/${video.id}/raw/${cleanFilename}`,
      `${video.workspaceId}/${video.id}/raw/imported.mp4`
    ];

    const cdnBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://cdn.framevid.co';
    const baseUrl = cdnBase.replace(/\/$/, '');

    // In a real production app with R2, we'd do a HeadObject to see which key exists.
    // For now, since we only have two possibilities, we can just redirect to the one that is most likely, 
    // or we can test if the local file exists if we are in local dev.
    
    let selectedKey = possibleKeys[0];
    
    if (process.env.NODE_ENV === 'development') {
      const fs = require('fs');
      const { localUploadPath } = require('../../../../../lib/storage');
      
      if (!fs.existsSync(localUploadPath(selectedKey))) {
        if (fs.existsSync(localUploadPath(possibleKeys[1]))) {
          selectedKey = possibleKeys[1];
        }
      }
    } else {
      // In production, we'll try to use the imported.mp4 if originalFilename looks like it came from yt-dlp (has title).
      // Actually, imports using yt-dlp might not always be 'imported.mp4' if we fix the worker later, 
      // but for now this covers our existing videos.
      // A better way is to do a quick fetch HEAD request to check.
      try {
        const headRes = await fetch(`${baseUrl}/${selectedKey}`, { method: 'HEAD' });
        if (!headRes.ok) {
          selectedKey = possibleKeys[1];
        }
      } catch (e) {
        // ignore
      }
    }

    const cdnUrl = `${baseUrl}/${selectedKey}`;
    const rawUrl = resolveMediaUrl(cdnUrl) || cdnUrl;

    // Redirect to the actual download URL
    return NextResponse.redirect(rawUrl);

  } catch (error) {
    console.error('Download route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
