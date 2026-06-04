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
  uploadFileToR2,
  deleteFromR2,
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

async function encodeAllLaddersConcurrently(
  tempDir: string,
  rawFilePath: string,
  ladders: HlsLadder[],
  audioExtracted: boolean,
  workspaceId: string,
  videoId: string
): Promise<Set<string>> {
  const filterParts: string[] = [];
  
  if (ladders.length > 1) {
    const splitStr = `[0:v]split=${ladders.length}` + ladders.map((_, i) => `[v${i}]`).join('');
    filterParts.push(splitStr);
  } else {
    filterParts.push(`[0:v]copy[v0]`);
  }

  ladders.forEach((ladder, i) => {
    filterParts.push(`[v${i}]scale=-2:${ladder.height}[v${i}out]`);
  });

  const filterComplex = filterParts.join(';');

  const args = [
    '-y',
    '-i', rawFilePath,
    '-filter_complex', filterComplex,
  ];

  const varStreamMap: string[] = [];

  // Audio: map as a separate audio-only group so it is not duplicated across variants
  if (audioExtracted) {
    args.push('-map', '0:a?', '-c:a:0', 'aac', '-b:a:0', '128k');
    varStreamMap.push('a:0,agroup:audio,default:yes');
  }

  ladders.forEach((ladder, i) => {
    args.push(
      '-map', `[v${i}out]`,
      `-c:v:${i}`, 'libx264',
      `-b:v:${i}`, ladder.bandwidth.toString(),
      '-maxrate', Math.floor(ladder.bandwidth * 1.2).toString(),
      '-bufsize', Math.floor(ladder.bandwidth * 2).toString(),
      '-crf', '23',
      '-preset', ffmpegPreset(),
      '-g', '48',
      '-sc_threshold', '0'
    );

    const mapStr = audioExtracted
      ? `v:${i},agroup:audio,name:${ladder.label}`
      : `v:${i},name:${ladder.label}`;
    varStreamMap.push(mapStr);
  });

  args.push(
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', varStreamMap.join(' '),
    '-hls_segment_filename', path.join(tempDir, `%v_%03d.ts`),
    path.join(tempDir, `%v.m3u8`)
  );

  const uploadQueue: string[] = [];
  const uploadedSet = new Set<string>();
  let isFfmpegDone = false;
  let ffmpegError: Error | null = null;

  console.log(`[Worker] Starting concurrent FFmpeg pass for ${videoId}`);
  const ffmpegPromise = runFFmpeg(args).then(() => {
    isFfmpegDone = true;
  }).catch(err => {
    isFfmpegDone = true;
    ffmpegError = err;
  });

  const pollInterval = setInterval(async () => {
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        if (file.endsWith('.ts') && !file.endsWith('.tmp') && !uploadedSet.has(file)) {
          uploadedSet.add(file);
          uploadQueue.push(file);
        }
      }
      processUploadQueue();
    } catch (e) {
      // ignore
    }
  }, 500);

  let activeUploads = 0;
  const MAX_CONCURRENT = 10;

  async function processUploadQueue() {
    while (uploadQueue.length > 0 && activeUploads < MAX_CONCURRENT) {
      const file = uploadQueue.shift()!;
      activeUploads++;
      
      const filePath = path.join(tempDir, file);
      const r2Key = `${workspaceId}/${videoId}/transcoded/${file}`;
      
      uploadFileToR2(filePath, r2Key).then(() => {
        activeUploads--;
        processUploadQueue();
      }).catch(err => {
        console.error(`[Worker] Failed JIT upload for ${file}`, err);
        activeUploads--;
        uploadedSet.delete(file); // allow retry
        processUploadQueue();
      });
    }
  }

  await ffmpegPromise;
  
  clearInterval(pollInterval);
  
  await new Promise<void>((resolve) => {
    const waitInterval = setInterval(() => {
      if (uploadQueue.length === 0 && activeUploads === 0) {
        clearInterval(waitInterval);
        resolve();
      }
    }, 200);
  });

  if (ffmpegError) throw ffmpegError;
  
  return uploadedSet;
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

    let audioUrl: string | null = null;
    try {
      audioUrl = await extractAndUploadAudio(rawFilePath, tempDir, workspaceId, videoId);
    } catch (audioErr) {
      console.warn(`[Worker] Audio extract failed for ${videoId}:`, audioErr);
    }

    // 2. Video Processing: Parallel HLS ladders with JIT uploading
    const sourceHeight = await probeSourceHeight(rawFilePath);
    const ladders = laddersForSource(sourceHeight);
    console.log(`[Worker] Selected ladders for ${videoId}:`, ladders.map((l) => l.label));

    const uploadedSet = await encodeAllLaddersConcurrently(tempDir, rawFilePath, ladders, Boolean(audioUrl), workspaceId, videoId);

    // 3. Final Sweep: Generate thumbnail and upload manifests
    await generateThumbnail(tempDir, rawFilePath);
    
    // r2.ts handles leftover files (.m3u8 manifests, .jpg thumbnail)
    const { masterUrl, thumbUrl } = await uploadTranscodeOutputs(tempDir, workspaceId, videoId, uploadedSet);
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

    // 4. Cleanup: Delete the raw source file from R2 to save storage
    try {
      await deleteFromR2(rawKey);
      console.log(`[Worker] Deleted raw file from R2: ${rawKey}`);
    } catch (cleanupErr) {
      console.warn(`[Worker] Could not delete raw file ${rawKey}:`, cleanupErr);
    }
    // Also delete raw from local disk storage
    try {
      const localRaw = localUploadPath(rawKey);
      await fs.unlink(localRaw);
    } catch { /* may not exist */ }
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
