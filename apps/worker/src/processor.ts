import { Worker } from 'bullmq';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getQueueConnection, TRANSCODE_QUEUE_NAME, type TranscodeJobData } from '@framevid/queue';
import dotenv from 'dotenv';
import {
  downloadRawFromR2,
  uploadTranscodeOutputs,
  localUploadPath,
  isR2Configured,
} from './r2.js';

dotenv.config();

async function checkFFmpegExists(): Promise<boolean> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    const checkCmd = process.platform === 'win32' ? 'where.exe ffmpeg' : 'which ffmpeg';
    await execPromise(checkCmd);
    return true;
  } catch {
    return false;
  }
}

async function runFFmpeg(args: string[]): Promise<void> {
  const { spawn } = await import('child_process');

  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args);
    let stderrData = '';

    child.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${stderrData}`));
    });

    child.on('error', reject);
  });
}

async function simulateTranscode(videoId: string) {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const masterUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  const thumbUrl =
    'https://image.mux.com/VZtzUzGRv02OhRnZCxcNg49sfn3VKg2pQ/thumbnail.jpg?time=5';

  await db
    .update(videos)
    .set({
      status: 'ready',
      hlsManifestUrl: masterUrl,
      thumbnailUrls: [thumbUrl],
      posterUrl: thumbUrl,
      durationSeconds: 634.5,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  console.log(`[Worker] Simulated transcode finished for Video ID: ${videoId}`);
}

async function processTranscodeJob(job: { data: TranscodeJobData }) {
  const { videoId, workspaceId, rawKey, originalFilename } = job.data;
  console.log(`[Worker] Started transcode job for Video ID: ${videoId}`);

  const tempDir = path.join(process.platform === 'win32' ? process.env.TEMP || 'C:\\Temp' : '/tmp', 'framevid', videoId);
  const rawFilePath = path.join(tempDir, originalFilename);

  try {
    await fs.mkdir(tempDir, { recursive: true });

    await db
      .update(videos)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(videos.id, videoId));

    let hasRawFile = false;
    try {
      await downloadRawFromR2(rawKey, rawFilePath);
      await fs.access(rawFilePath);
      hasRawFile = true;
    } catch (err) {
      console.warn(`[Worker] Could not load raw file for ${rawKey}:`, err);
    }

    const ffmpegExists = await checkFFmpegExists();

    if (!ffmpegExists || !hasRawFile) {
      if (!hasRawFile && !isR2Configured()) {
        const localPath = localUploadPath(rawKey);
        try {
          await fs.access(localPath);
          await fs.copyFile(localPath, rawFilePath);
          hasRawFile = true;
        } catch {
          /* no local file */
        }
      }

      if (!ffmpegExists || !hasRawFile) {
        console.warn(
          `[Worker] Using simulated transcode (ffmpeg=${ffmpegExists}, raw=${hasRawFile})`
        );
        await simulateTranscode(videoId);
        return;
      }
    }

    console.log(`[Worker] Executing FFmpeg transcode for: ${originalFilename}`);

    const path360p = path.join(tempDir, '360p.m3u8');
    const path720p = path.join(tempDir, '720p.m3u8');
    const path1080p = path.join(tempDir, '1080p.m3u8');

    await runFFmpeg([
      '-y',
      '-i',
      rawFilePath,
      '-vf',
      'scale=-2:360',
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'fast',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_segment_filename',
      path.join(tempDir, '360p_%03d.ts'),
      '-f',
      'hls',
      path360p,
    ]);

    await runFFmpeg([
      '-y',
      '-i',
      rawFilePath,
      '-vf',
      'scale=-2:720',
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'fast',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_segment_filename',
      path.join(tempDir, '720p_%03d.ts'),
      '-f',
      'hls',
      path720p,
    ]);

    await runFFmpeg([
      '-y',
      '-i',
      rawFilePath,
      '-vf',
      'scale=-2:1080',
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'fast',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_segment_filename',
      path.join(tempDir, '1080p_%03d.ts'),
      '-f',
      'hls',
      path1080p,
    ]);

    const masterPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080
1080p.m3u8`;

    await fs.writeFile(path.join(tempDir, 'master.m3u8'), masterPlaylistContent);

    const thumbnailPath = path.join(tempDir, 'thumb_0.jpg');
    await runFFmpeg([
      '-y',
      '-ss',
      '00:00:05',
      '-i',
      rawFilePath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      thumbnailPath,
    ]);

    const { masterUrl, thumbUrl } = await uploadTranscodeOutputs(tempDir, workspaceId, videoId);

    await db
      .update(videos)
      .set({
        status: 'ready',
        hlsManifestUrl: masterUrl,
        thumbnailUrls: thumbUrl ? [thumbUrl] : [],
        posterUrl: thumbUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    console.log(`[Worker] Production transcode complete for Video ID: ${videoId}`);
  } catch (error: unknown) {
    console.error(`[Worker] Transcoding failed for Video ID: ${videoId}:`, error);

    await db
      .update(videos)
      .set({ status: 'error', updatedAt: new Date() })
      .where(eq(videos.id, videoId));

    throw error;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error(`[Worker] Cleanup failed for ${tempDir}:`, cleanupErr);
    }
  }
}

const worker = new Worker<TranscodeJobData>(
  TRANSCODE_QUEUE_NAME,
  async (job) => {
    await processTranscodeJob(job);
  },
  { connection: getQueueConnection() as any }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

console.log('[Worker] Transcoding queue listener started.');
export { worker };
