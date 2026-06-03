import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { localUploadPath } from '../../../../lib/storage';

function contentTypeForKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.vtt') return 'text/vtt; charset=utf-8';
  if (ext === '.srt') return 'text/plain; charset=utf-8';
  if (key.endsWith('/raw') || key.endsWith('/transcoded')) return 'video/mp4';
  return 'application/octet-stream';
}

/** Serve files written to LOCAL_UPLOAD_DIR (dev / mock R2). */
export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  try {
    if (!params.key || params.key.length === 0) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    const key = params.key.join('/');
    if (params.key.includes('..')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const filePath = localUploadPath(key);
    let buffer = await fs.readFile(filePath);

    if (key.endsWith('.m3u8')) {
      const origin = new URL(req.url).origin;
      const dir = key.includes('/') ? key.replace(/\/[^/]+$/, '') : '';
      const text = buffer
        .toString('utf8')
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
          const childKey = dir ? `${dir}/${trimmed}` : trimmed;
          return `${origin}/api/media/${childKey}`;
        })
        .join('\n');
      buffer = Buffer.from(text, 'utf8');
    }

    const range = req.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      
      const chunk = buffer.subarray(start, end + 1);
      
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentTypeForKey(key),
          'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunk.length.toString(),
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentTypeForKey(key),
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    },
  });
}
