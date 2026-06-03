import { Worker } from 'bullmq';
import fs from 'fs/promises';
import path from 'path';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getQueueConnection, TRANSCODE_QUEUE_NAME, IMPORT_QUEUE_NAME, type TranscodeJobData, type ImportJobData, enqueueTranscodeJob } from '@framevid/queue';
import youtubedl from 'youtube-dl-exec';
import dotenv from 'dotenv';
import {
  downloadRawFromR2,
  uploadTranscodeOutputs,
  localUploadPath,
  isR2Configured,
} from './r2.js';
import { extractAndUploadAudio } from './deepgram.js';
import { startHealthServer } from './health-server.js';

dotenv.config();

startHealthServer();

console.log('[Worker] Booting FrameVid worker', {
  node: process.version,
  redis: Boolean(process.env.REDIS_URL),
  database: Boolean(process.env.DATABASE_URL),
  r2: Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID),
});

void (async () => {
  try {
    const pong = await getQueueConnection().ping();
    console.log(`[Worker] Redis ping: ${pong}`);
  } catch (err) {
    console.error('[Worker] Redis connection failed — jobs will not run:', err);
  }
})();

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

async function probeDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { spawn } = await import('child_process');
    return await new Promise((resolve) => {
      const child = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      let stdout = '';
      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.on('close', () => {
        const n = parseFloat(stdout.trim());
        resolve(Number.isFinite(n) ? n : null);
      });
      child.on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

async function probeResolution(filePath: string): Promise<string | null> {
  try {
    const { spawn } = await import('child_process');
    return await new Promise((resolve) => {
      const child = spawn('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=s=x:p=0',
        filePath,
      ]);
      let stdout = '';
      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.on('close', () => {
        const res = stdout.trim();
        resolve(res.includes('x') ? res : null);
      });
      child.on('error', () => resolve(null));
    });
  } catch {
    return null;
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

const HLS_LADDERS = [
  { label: '360p', height: 360, bandwidth: 800_000, display: '640x360' },
  { label: '720p', height: 720, bandwidth: 1_400_000, display: '1280x720' },
  { label: '1080p', height: 1080, bandwidth: 2_800_000, display: '1920x1080' },
] as const;

type HlsLadder = (typeof HLS_LADDERS)[number];

function ffmpegPreset(): string {
  return process.env.FFMPEG_PRESET?.trim() || 'veryfast';
}

/** Set TRANSCODE_CONCURRENCY=1 on 512MB instances if jobs OOM. Default 3 = all ladders in parallel. */
function transcodeConcurrency(): number {
  const n = Number(process.env.TRANSCODE_CONCURRENCY);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
}

async function probeSourceHeight(filePath: string): Promise<number | null> {
  const res = await probeResolution(filePath);
  if (!res) return null;
  const parts = res.split('x');
  const h = Number(parts[1]);
  return Number.isFinite(h) ? h : null;
}

function laddersForSource(sourceHeight: number | null): HlsLadder[] {
  if (sourceHeight == null) return [...HLS_LADDERS];
  return HLS_LADDERS.filter((l) => l.height <= sourceHeight);
}

async function encodeHlsLadder(tempDir: string, rawFilePath: string, ladder: HlsLadder): Promise<void> {
  const playlistPath = path.join(tempDir, `${ladder.label}.m3u8`);
  await runFFmpeg([
    '-y',
    '-i',
    rawFilePath,
    '-vf',
    `scale=-2:${ladder.height}`,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    ffmpegPreset(),
    '-hls_time',
    '6',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    path.join(tempDir, `${ladder.label}_%03d.ts`),
    '-f',
    'hls',
    playlistPath,
  ]);
}

function buildMasterPlaylist(ladders: HlsLadder[]): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const ladder of ladders) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${ladder.bandwidth},RESOLUTION=${ladder.display}`);
    lines.push(`${ladder.label}.m3u8`);
  }
  return `${lines.join('\n')}\n`;
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  if (tasks.length === 0) return [];
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

async function generateThumbnail(tempDir: string, rawFilePath: string): Promise<string> {
  const thumbnailPath = path.join(tempDir, 'thumb_0.jpg');
  await runFFmpeg([
    '-y',
    '-ss',
    '00:00:05',
    '-i',
    rawFilePath,
    '-vframes',
    '1',
    '-pix_fmt',
    'yuvj420p',
    '-q:v',
    '2',
    '-strict',
    'unofficial',
    thumbnailPath,
  ]);
  return thumbnailPath;
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

    const sourceHeight = await probeSourceHeight(rawFilePath);
    const ladders = laddersForSource(sourceHeight);
    const concurrency = transcodeConcurrency();

    console.log(
      `[Worker] FFmpeg transcode for ${originalFilename}: ladders=${ladders.map((l) => l.label).join(', ')} preset=${ffmpegPreset()} concurrency=${concurrency}`
    );

    const transcodeStarted = Date.now();
    await runWithConcurrency(
      [
        ...ladders.map((ladder) => () => encodeHlsLadder(tempDir, rawFilePath, ladder)),
        () => generateThumbnail(tempDir, rawFilePath),
      ],
      concurrency
    );
    console.log(
      `[Worker] Encode + thumbnail finished in ${((Date.now() - transcodeStarted) / 1000).toFixed(1)}s`
    );

    await fs.writeFile(path.join(tempDir, 'master.m3u8'), buildMasterPlaylist(ladders));

    const { masterUrl, thumbUrl } = await uploadTranscodeOutputs(tempDir, workspaceId, videoId);
    const durationSeconds = (await probeDurationSeconds(rawFilePath)) ?? undefined;
    const resolution = await probeResolution(rawFilePath);

    let settingsUpdate: any = undefined;
    if (resolution) {
      const [currentVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      if (currentVideo && currentVideo.settings) {
        settingsUpdate = {
          ...(currentVideo.settings as any),
          resolution,
        };
      }
    }

    let audioUrl: string | null = null;
    try {
      audioUrl = await extractAndUploadAudio(rawFilePath, tempDir, workspaceId, videoId);
    } catch (audioErr) {
      console.warn(`[Worker] Audio extract failed for ${videoId}:`, audioErr);
    }

    await db
      .update(videos)
      .set({
        status: 'ready',
        hlsManifestUrl: masterUrl,
        thumbnailUrls: thumbUrl ? [thumbUrl] : [],
        posterUrl: thumbUrl || null,
        durationSeconds: durationSeconds ?? null,
        ...(settingsUpdate && { settings: settingsUpdate }),
        audioExtracted: Boolean(audioUrl),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    // Audio has been extracted and uploaded to R2, setting `audioExtracted: true` in the DB.
    // We no longer trigger AI transcription here; it is now strictly on-demand via the dashboard.

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

worker.on('active', (job) => {
  console.log(`[Worker] Active transcode job ${job.id} videoId=${job.data.videoId}`);
});

worker.on('completed', (job) => {
  console.log(`[Worker] Completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[Worker] Transcode queue error:', err);
});

console.log(`[Worker] Listening on queue "${TRANSCODE_QUEUE_NAME}"`);

async function processImportJob(job: { data: ImportJobData }) {
  const { videoId, workspaceId, url } = job.data;
  console.log(`[Worker] Started import job for Video ID: ${videoId} from ${url}`);

  const tempDir = path.join(process.platform === 'win32' ? process.env.TEMP || 'C:\\Temp' : '/tmp', 'framevid', `import_${videoId}`);
  const importedFilename = 'imported.mp4';
  const rawFilePath = path.join(tempDir, importedFilename);
  const rawKey = `${workspaceId}/${videoId}/raw/${importedFilename}`;

  try {
    await fs.mkdir(tempDir, { recursive: true });

    await db
      .update(videos)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(videos.id, videoId));

    console.log(`[Worker] Downloading ${url} via youtube-dl-exec...`);
    await youtubedl(url, {
      output: rawFilePath,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      noCheckCertificates: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=android,web',
    });

    // Check if the file was downloaded successfully and get its size
    await fs.access(rawFilePath);
    const stats = await fs.stat(rawFilePath);
    
    // Save the file size to the database
    await db.update(videos).set({ sizeBytes: stats.size }).where(eq(videos.id, videoId));

    // Upload to R2 or Mock local
    if (!isR2Configured()) {
      const localPath = localUploadPath(rawKey);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.copyFile(rawFilePath, localPath);
      console.log(`[Worker] Saved imported file to local upload path: ${localPath}`);
    } else {
      const { uploadFileToR2 } = await import('./r2.js');
      await uploadFileToR2(rawFilePath, rawKey);
      console.log(`[Worker] Uploaded imported file to R2: ${rawKey}`);
    }

    // Try to extract title
    try {
      const info: any = await youtubedl(url, { 
        dumpJson: true, 
        noWarnings: true,
        extractorArgs: 'youtube:player_client=android,web',
      });
      if (info?.title) {
        await db.update(videos).set({ title: info.title, originalFilename: `${info.title}.mp4` }).where(eq(videos.id, videoId));
      }
    } catch (err) {
      console.warn(`[Worker] Failed to extract metadata for ${url}:`, err);
    }

    console.log(`[Worker] Enqueuing transcode job for imported video: ${videoId}`);
    await enqueueTranscodeJob({
      videoId,
      workspaceId,
      rawKey,
      originalFilename: importedFilename,
    });

  } catch (error: any) {
    console.error(`[Worker] Import failed for Video ID: ${videoId}:`, error);
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



const importWorker = new Worker<ImportJobData>(
  IMPORT_QUEUE_NAME,
  async (job) => {
    await processImportJob(job);
  },
  { connection: getQueueConnection() as any }
);

importWorker.on('active', (job) => {
  console.log(`[Worker] Active import job ${job.id} videoId=${job.data.videoId}`);
});

importWorker.on('completed', (job) => {
  console.log(`[Worker] Completed import job ${job.id}`);
});

importWorker.on('failed', (job, err) => {
  console.error(`[Worker] Import job ${job?.id} failed:`, err);
});

importWorker.on('error', (err) => {
  console.error('[Worker] Import queue error:', err);
});

console.log(`[Worker] Listening on queue "${IMPORT_QUEUE_NAME}"`);

async function shutdown(signal: string) {
  console.log(`[Worker] ${signal} received, closing workers...`);
  await Promise.all([worker.close(), importWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export { worker, importWorker };
