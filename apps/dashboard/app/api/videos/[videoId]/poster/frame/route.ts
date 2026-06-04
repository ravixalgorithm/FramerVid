import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../../../lib/auth';
import { localUploadPath } from '../../../../../../lib/storage';
import { posterStorageKey } from '../../../../../lib/asset-url';
import { resolveRemoteHlsForFfmpeg } from '../../../../../lib/poster-frame-sources';
import { uploadToR2, deleteFromR2 } from '../../../../../../lib/r2';
import { invalidateVideoCache } from '../../../../../../lib/cache';

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

function runFfmpegFrame(inputPath: string, outputPath: string, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss',
      String(Math.max(0, timeSeconds)),
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-q:v',
      '2',
      outputPath,
    ];
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('ffmpeg is not installed (required for server frame capture)'));
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function findReadableFile(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function resolveLocalSourcePath(
  workspaceId: string,
  videoId: string,
  originalFilename: string,
  origin: string,
  hlsManifestUrl: string | null,
): Promise<string | null> {
  const rawDir = localUploadPath(`${workspaceId}/${videoId}/raw`);
  const candidates: string[] = [
    localUploadPath(`${workspaceId}/${videoId}/raw/${originalFilename}`),
    localUploadPath(`${workspaceId}/${videoId}/transcoded/master.m3u8`),
  ];

  try {
    const files = await fs.readdir(rawDir);
    for (const name of files) {
      candidates.push(path.join(rawDir, name));
    }
  } catch {
    /* no raw dir */
  }

  const local = await findReadableFile(candidates);
  if (local) return local;

  const remoteHls = resolveRemoteHlsForFfmpeg(hlsManifestUrl);
  if (remoteHls) return remoteHls;

  if (hlsManifestUrl) {
    const bases = [CDN_BASE.replace(/\/$/, ''), 'https://cdn.framevid.co'];
    for (const base of bases) {
      if (hlsManifestUrl.startsWith(`${base}/`)) {
        const key = hlsManifestUrl.slice(base.length + 1);
        return `${origin}/api/media?key=${encodeURIComponent(key)}`;
      }
    }
  }

  return null;
}

async function savePosterBuffer(buffer: Buffer, workspaceId: string, videoId: string, origin: string) {
  const posterKey = posterStorageKey(workspaceId, videoId);

  // Delete old poster before writing new one (saves storage cost)
  try { await deleteFromR2(posterKey); } catch { /* may not exist */ }
  try { await fs.unlink(localUploadPath(posterKey)); } catch { /* may not exist */ }

  // Upload to R2 if configured, otherwise write to local disk
  const uploadedToR2 = await uploadToR2(posterKey, buffer, 'image/jpeg');

  if (!uploadedToR2) {
    const dest = localUploadPath(posterKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
  }

  const posterUrl = publicUrlForKey(posterKey, origin);
  const [updated] = await db
    .update(videos)
    .set({ posterUrl, updatedAt: new Date() })
    .where(eq(videos.id, videoId))
    .returning();
  await invalidateVideoCache(videoId);
  return { posterUrl, video: updated };
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

    const body = (await req.json()) as { timeSeconds?: number };
    const timeSeconds = Number.isFinite(body.timeSeconds) ? Math.max(0, body.timeSeconds!) : 0;

    const sourcePath = await resolveLocalSourcePath(
      video.workspaceId,
      videoId,
      video.originalFilename,
      req.nextUrl.origin,
      video.hlsManifestUrl,
    );

    if (!sourcePath) {
      return NextResponse.json(
        { error: 'No video source found for frame capture' },
        { status: 404 },
      );
    }

    const posterKey = posterStorageKey(video.workspaceId, videoId);
    const dest = localUploadPath(posterKey);
    const tempOut = path.join(path.dirname(dest), `frame-${Date.now()}.jpg`);

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await runFfmpegFrame(sourcePath, tempOut, timeSeconds);
    await fs.rename(tempOut, dest);

    const data = await savePosterBuffer(
      await fs.readFile(dest),
      video.workspaceId,
      videoId,
      req.nextUrl.origin,
    );

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Poster frame capture failed:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('ffmpeg') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
