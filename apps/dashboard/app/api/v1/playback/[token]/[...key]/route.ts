import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { localUploadPath } from '../../../../../../lib/storage';
import { verifySession } from '../../../../../lib/auth';

const CDN_BASE =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  'https://cdn.framevid.co';

function useLocalMediaProxy(): boolean {
  return process.env.NODE_ENV === 'development';
}

function contentTypeForKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.vtt') return 'text/vtt; charset=utf-8';
  if (ext === '.srt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string; key: string[] } }
) {
  try {
    const { token, key: keyArray } = params;
    
    if (!token || !keyArray || keyArray.length === 0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const payload = verifySession(token);
    if (!payload || !payload.videoId) {
      return NextResponse.json({ error: 'Unauthorized or expired token' }, { status: 401 });
    }

    const key = keyArray.join('/');
    
    // Check if the requested key actually belongs to the authorized videoId
    // Typical key: workspaceId/videoId/master.m3u8
    if (!key.includes(payload.videoId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contentType = contentTypeForKey(key);

    if (useLocalMediaProxy()) {
      const filePath = localUploadPath(key);
      try {
        const buffer = await fs.readFile(filePath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        return NextResponse.json({ error: 'Not found locally' }, { status: 404 });
      }
    } else {
      // Proxy from CDN
      const targetUrl = `${CDN_BASE.replace(/\/$/, '')}/${key}`;
      const cdnRes = await fetch(targetUrl);
      
      if (!cdnRes.ok) {
        return NextResponse.json({ error: 'Not found on CDN' }, { status: cdnRes.status });
      }

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'public, max-age=3600');
      headers.set('Access-Control-Allow-Origin', '*');

      return new NextResponse(cdnRes.body, {
        status: 200,
        headers,
      });
    }
  } catch (error: any) {
    console.error('Playback proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
