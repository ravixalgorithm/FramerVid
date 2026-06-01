import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { enqueueTranscodeJob } from '@framevid/queue';
import { localUploadPath } from '../../../../../lib/storage';

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    const dest = localUploadPath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);

    console.log(`[Mock Upload] Saved ${buffer.length} bytes → ${dest}`);

    const parts = key.split('/');
    if (parts.length >= 4) {
      const workspaceId = parts[0];
      const videoId = parts[1];
      const originalFilename = parts.slice(3).join('/');

      await enqueueTranscodeJob({
        videoId,
        workspaceId,
        rawKey: key,
        originalFilename,
      });

      console.log(`[Mock Upload] Queued transcode for video ${videoId}`);
    }

    return new Response(null, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('Mock upload receiver failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
