import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || 'mock',
  },
});

export const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'framevid-assets';
export const PUBLIC_CDN_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://cdn.framevid.co';

export function isR2Configured(): boolean {
  return Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID);
}

export function localUploadPath(rawKey: string): string {
  const base = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), '.data', 'uploads');
  return path.join(base, rawKey);
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
  return 'application/octet-stream';
}

export async function uploadFileToR2(
  filePath: string,
  key: string
): Promise<string> {
  if (!isR2Configured()) {
    console.log(`[R2 Simulator] Mock uploaded ${filePath} → ${key}`);
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

/** Upload transcode outputs from a flat temp directory. */
export async function uploadTranscodeOutputs(
  tempDir: string,
  workspaceId: string,
  videoId: string
): Promise<{ masterUrl: string; thumbUrl: string }> {
  const files = await walkFiles(tempDir);
  let masterUrl = '';
  let thumbUrl = '';

  for (const filePath of files) {
    const name = path.basename(filePath);
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      thumbUrl = await uploadFileToR2(
        filePath,
        `${workspaceId}/${videoId}/thumbnails/${name}`
      );
    } else if (name.endsWith('.m3u8') || name.endsWith('.ts')) {
      const url = await uploadFileToR2(
        filePath,
        `${workspaceId}/${videoId}/transcoded/${name}`
      );
      if (name === 'master.m3u8') masterUrl = url;
    }
  }

  if (!masterUrl) {
    masterUrl = `${PUBLIC_CDN_URL}/${workspaceId}/${videoId}/transcoded/master.m3u8`;
  }

  return { masterUrl, thumbUrl };
}
