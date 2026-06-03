import type { WorkspacePlan } from '@framevid/types';

export type PlanLimits = {
  maxVideos: number | null;
  maxBytesPerVideo: number | null;
  maxDurationSeconds: number | null;
  label: string;
};

const LIMITS: Record<WorkspacePlan, PlanLimits> = {
  free: {
    maxVideos: 10,
    maxBytesPerVideo: 100 * 1024 * 1024,
    maxDurationSeconds: 5 * 60,
    label: 'Free',
  },
  starter: {
    maxVideos: 50,
    maxBytesPerVideo: 500 * 1024 * 1024,
    maxDurationSeconds: 30 * 60,
    label: 'Starter',
  },
  pro: {
    maxVideos: null,
    maxBytesPerVideo: 5 * 1024 * 1024 * 1024,
    maxDurationSeconds: null,
    label: 'Pro',
  },
  agency: {
    maxVideos: null,
    maxBytesPerVideo: null,
    maxDurationSeconds: null,
    label: 'Agency',
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  if (plan in LIMITS) return LIMITS[plan as WorkspacePlan];
  return LIMITS.free;
}

export function formatMaxFileSize(bytes: number | null): string {
  if (bytes === null) return 'Unlimited';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
  return `${Math.round(mb)}MB`;
}

export function formatMaxDuration(seconds: number | null): string {
  if (seconds === null) return 'Unlimited';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)} min`;
}
