import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const TRANSCODE_QUEUE_NAME = 'video-transcode';
export const IMPORT_QUEUE_NAME = 'video-import';

let connection: Redis | null = null;
let transcodeQueue: Queue<TranscodeJobData> | null = null;
let importQueue: Queue<ImportJobData> | null = null;

function getConnection(): Redis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return connection;
}

export interface TranscodeJobData {
  videoId: string;
  workspaceId: string;
  rawKey: string;
  originalFilename: string;
}

export interface ImportJobData {
  videoId: string;
  workspaceId: string;
  url: string;
}

function getTranscodeQueue(): Queue<TranscodeJobData> {
  if (!transcodeQueue) {
    transcodeQueue = new Queue<TranscodeJobData>(TRANSCODE_QUEUE_NAME, {
      connection: getConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });
  }
  return transcodeQueue;
}

export async function enqueueTranscodeJob(data: TranscodeJobData) {
  return getTranscodeQueue().add('transcode', data);
}

function getImportQueue(): Queue<ImportJobData> {
  if (!importQueue) {
    importQueue = new Queue<ImportJobData>(IMPORT_QUEUE_NAME, {
      connection: getConnection() as any,
      defaultJobOptions: {
        attempts: 2, // External downloads might fail permanently or temporarily
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    });
  }
  return importQueue;
}

export async function enqueueImportJob(data: ImportJobData) {
  return getImportQueue().add('import', data);
}

/** BullMQ worker connection (lazy — safe at build time). */
export function getQueueConnection(): Redis {
  return getConnection();
}
