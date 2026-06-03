import { db, videoEvents } from '@framevid/db';
import { and, eq, sql } from 'drizzle-orm';

export const HEARTBEAT_BUCKET_SECONDS = 5;

export async function getHeartbeatBucketCounts(videoId: string): Promise<Map<number, number>> {
  const rows = await db
    .select({
      bucket: sql<number>`(FLOOR((${videoEvents.eventData}->>'bucket')::numeric / ${HEARTBEAT_BUCKET_SECONDS}) * ${HEARTBEAT_BUCKET_SECONDS})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(videoEvents)
    .where(and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'heartbeat')))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.bucket != null) map.set(Number(row.bucket), Number(row.count));
  }
  return map;
}

/** Normalize raw bucket counts to 0–100 heights for public popularity graph. */
export function normalizePopularityCurve(countsByBucket: Map<number, number>, durationSeconds?: number): number[] {
  if (countsByBucket.size === 0) return [];

  const maxBucket = durationSeconds
    ? Math.max(0, Math.ceil(durationSeconds / HEARTBEAT_BUCKET_SECONDS) * HEARTBEAT_BUCKET_SECONDS)
    : Math.max(...Array.from(countsByBucket.keys()));

  const buckets: number[] = [];
  for (let b = 0; b <= maxBucket; b += HEARTBEAT_BUCKET_SECONDS) {
    buckets.push(b);
  }

  const counts = buckets.map((b) => countsByBucket.get(b) ?? 0);
  const max = Math.max(...counts, 1);
  return counts.map((c) => Math.round((c / max) * 100));
}

export async function getRetentionSeries(videoId: string, durationSeconds?: number): Promise<{
  bucketSeconds: number;
  buckets: number[];
  retentionPct: number[];
}> {
  const playSessions = await db
    .select({ count: sql<number>`count(distinct ${videoEvents.sessionId})::int` })
    .from(videoEvents)
    .where(and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'video_play')));

  const totalPlays = Number(playSessions[0]?.count || 0);
  if (totalPlays === 0) {
    return { bucketSeconds: HEARTBEAT_BUCKET_SECONDS, buckets: [], retentionPct: [] };
  }

  const heartbeatRows = await db
    .select({
      bucket: sql<number>`(FLOOR((${videoEvents.eventData}->>'bucket')::numeric / ${HEARTBEAT_BUCKET_SECONDS}) * ${HEARTBEAT_BUCKET_SECONDS})::int`,
      sessions: sql<number>`count(distinct ${videoEvents.sessionId})::int`,
    })
    .from(videoEvents)
    .where(
      and(
        eq(videoEvents.videoId, videoId),
        eq(videoEvents.eventType, 'heartbeat'),
        sql`${videoEvents.sessionId} is not null`
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const sessionMap = new Map<number, number>();
  for (const row of heartbeatRows) {
    if (row.bucket != null) sessionMap.set(Number(row.bucket), Number(row.sessions));
  }

  const maxBucket = durationSeconds
    ? Math.max(0, Math.ceil(durationSeconds / HEARTBEAT_BUCKET_SECONDS) * HEARTBEAT_BUCKET_SECONDS)
    : heartbeatRows.length > 0
      ? Math.max(...heartbeatRows.map((r) => Number(r.bucket)))
      : 0;

  const buckets: number[] = [];
  const retentionPct: number[] = [];
  for (let b = 0; b <= maxBucket; b += HEARTBEAT_BUCKET_SECONDS) {
    buckets.push(b);
    const sessions = sessionMap.get(b) ?? 0;
    retentionPct.push(Math.round((sessions / totalPlays) * 100));
  }

  return { bucketSeconds: HEARTBEAT_BUCKET_SECONDS, buckets, retentionPct };
}

const CLIFF_MIN_DROP = 15;

export async function getAudienceBreakdown(videoId: string): Promise<{
  devices: { label: string; count: number; pct: number }[];
  referrers: { label: string; count: number; pct: number }[];
}> {
  const baseFilter = and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'video_play'));

  const deviceRows = await db
    .select({
      label: sql<string>`coalesce(nullif(${videoEvents.deviceType}, ''), 'unknown')`,
      count: sql<number>`count(*)::int`,
    })
    .from(videoEvents)
    .where(baseFilter)
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`);

  const referrerRows = await db
    .select({
      label: sql<string>`coalesce(nullif(${videoEvents.referrerDomain}, ''), 'direct')`,
      count: sql<number>`count(*)::int`,
    })
    .from(videoEvents)
    .where(baseFilter)
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(8);

  const deviceTotal = deviceRows.reduce((sum, r) => sum + Number(r.count), 0) || 1;
  const referrerTotal = referrerRows.reduce((sum, r) => sum + Number(r.count), 0) || 1;

  return {
    devices: deviceRows.map((r) => ({
      label: r.label,
      count: Number(r.count),
      pct: Math.round((Number(r.count) / deviceTotal) * 100),
    })),
    referrers: referrerRows.map((r) => ({
      label: r.label,
      count: Number(r.count),
      pct: Math.round((Number(r.count) / referrerTotal) * 100),
    })),
  };
}

export function detectRetentionCliff(retention: { buckets: number[]; retentionPct: number[] }): {
  cliffBucket: number;
  dropPct: number;
  fromPct: number;
  toPct: number;
} | null {
  if (retention.retentionPct.length < 2) return null;

  let worstIdx = -1;
  let worstDrop = 0;
  for (let i = 1; i < retention.retentionPct.length; i++) {
    const drop = retention.retentionPct[i - 1]! - retention.retentionPct[i]!;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstIdx = i - 1;
    }
  }

  if (worstIdx < 0 || worstDrop < CLIFF_MIN_DROP) return null;

  const fromPct = retention.retentionPct[worstIdx]!;
  const toPct = retention.retentionPct[worstIdx + 1]!;
  return {
    cliffBucket: retention.buckets[worstIdx]!,
    dropPct: worstDrop,
    fromPct,
    toPct,
  };
}
