import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { localUploadPath as sharedLocalUploadPath, resolveLocalUploadDir } from '@framevid/db';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'mock',
  },
  forcePathStyle: true,
});

export const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'framevid-assets';
export const PUBLIC_CDN_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://cdn.framevid.co';

export function isR2Configured(): boolean {
  return Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID);
}

export { resolveLocalUploadDir };

export function localUploadPath(rawKey: string): string {
  return sharedLocalUploadPath(rawKey);
}

/** Delete a single object from R2. Silently succeeds if the key doesn't exist. */
export async function deleteFromR2(key: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  } catch (err) {
    console.warn(`[R2] Failed to delete ${key}:`, err);
  }
}

export async function downloadRawFromR2(rawKey: string, destPath: string): Promise<void> {
  if (!isR2Configured()) {
    const localPath = localUploadPath(rawKey);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(localPath, destPath);
    return;
  }

  const response = await r2.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: rawKey,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty R2 object for key: ${rawKey}`);
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const body = response.Body as Readable;
  await pipeline(body, createWriteStream(destPath));
}

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.vtt') return 'text/vtt';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
}

export async function uploadFileToR2(
  filePath: string,
  key: string
): Promise<string> {
  if (!isR2Configured()) {
    const localPath = localUploadPath(key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.copyFile(filePath, localPath);
    console.log(`[R2 Simulator] Mock uploaded ${filePath} → ${localPath}`);
    return `${PUBLIC_CDN_URL}/${key}`;
  }

  const fileBuffer = await fs.readFile(filePath);
  const cacheControl = key.endsWith('.ts')
    ? 'public, max-age=31536000, immutable'
    : key.endsWith('.m3u8')
      ? 'public, max-age=300'
      : 'public, max-age=86400';

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentTypeForFile(filePath),
      CacheControl: cacheControl,
    })
  );

  return `${PUBLIC_CDN_URL}/${key}`;
}

async function walkFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walkFiles(fullPath)));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

export async function uploadTranscodeOutputs(
  tempDir: string,
  workspaceId: string,
  videoId: string,
  ignoreFiles?: Set<string>
): Promise<{ masterUrl: string; thumbUrl: string }> {
  const files = await walkFiles(tempDir);
  let masterUrl = '';
  let thumbUrl = '';

  const MAX_CONCURRENT = 10;
  
  // Create tasks array
  const uploadTasks = files.map(filePath => async () => {
    const name = path.basename(filePath);
    if (ignoreFiles && ignoreFiles.has(name)) return null;

    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      const url = await uploadFileToR2(
        filePath,
        `${workspaceId}/${videoId}/thumbnails/${name}`
      );
      return { type: 'thumb', url };
    } else if (name.endsWith('.m3u8') || name.endsWith('.ts')) {
      const url = await uploadFileToR2(
        filePath,
        `${workspaceId}/${videoId}/transcoded/${name}`
      );
      return { type: 'hls', name, url };
    }
    return null;
  });

  // Execute tasks with concurrency limit
  const results: ({ type: string; url: string; name?: string } | null)[] = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < uploadTasks.length) {
      const task = uploadTasks[nextIndex++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, uploadTasks.length) }, worker);
  await Promise.all(workers);

  for (const res of results) {
    if (!res) continue;
    if (res.type === 'thumb') thumbUrl = res.url;
    if (res.type === 'hls' && res.name === 'master.m3u8') masterUrl = res.url;
  }

  if (!masterUrl) {
    masterUrl = `${PUBLIC_CDN_URL}/${workspaceId}/${videoId}/transcoded/master.m3u8`;
  }

  return { masterUrl, thumbUrl };
}
