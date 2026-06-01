import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const TRANSCODE_QUEUE_NAME = 'video-transcode';

export interface TranscodeJobData {
  videoId: string;
  workspaceId: string;
  rawKey: string;
  originalFilename: string;
}

export const transcodeQueue = new Queue<TranscodeJobData>(TRANSCODE_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export async function enqueueTranscodeJob(data: TranscodeJobData) {
  return transcodeQueue.add('transcode', data);
}
