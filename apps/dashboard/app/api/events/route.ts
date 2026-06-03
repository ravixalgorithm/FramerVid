import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { VideoEventType } from '@framevid/types';
import { sql } from 'drizzle-orm';

const eventTypes = [
  'video_play',
  'video_pause',
  'video_progress',
  'video_complete',
  'video_seek',
  'heartbeat',
  'lightbox_open',
  'form_view',
  'form_submit',
  'form_submit_attempt',
  'form_submit_success',
  'form_submit_error',
  'form_skip',
  'cta_click',
] as const satisfies readonly VideoEventType[];

const heartbeatEventDataSchema = z.object({
  bucket: z.number().int().min(0),
  currentTime: z.number().min(0),
});

const eventSchema = z.object({
  videoId: z.string().uuid(),
  workspaceId: z.string().uuid().optional(),
  eventType: z.enum(eventTypes),
  progressPct: z.number().min(0).max(100).optional(),
  trackingLabel: z.string().max(128).optional(),
  sessionId: z.string().max(64).optional(),
  deviceType: z.string().max(64).optional(),
  country: z.string().max(8).optional(),
  referrerDomain: z.string().max(255).optional(),
  timestamp: z.string().optional(),
  eventData: z.record(z.unknown()).optional(),
});

function corsJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      raw = await req.json();
    } else {
      const rawText = await req.text();
      raw = JSON.parse(rawText);
    }

    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      return corsJson(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const payload = parsed.data;

    if (payload.eventType === 'heartbeat') {
      const hb = heartbeatEventDataSchema.safeParse(payload.eventData);
      if (!hb.success) {
        return corsJson(
          { error: 'heartbeat requires eventData.bucket and eventData.currentTime', code: 'VALIDATION_ERROR' },
          400
        );
      }
    }

    const { db, videoEvents } = await import('@framevid/db');
    await db.insert(videoEvents).values({
      videoId: payload.videoId,
      eventType: payload.eventType,
      progressPct: payload.progressPct,
      trackingLabel: payload.trackingLabel,
      sessionId: payload.sessionId,
      deviceType: payload.deviceType,
      country: payload.country,
      referrerDomain: payload.referrerDomain,
      eventData: payload.eventData ? sql`${JSON.stringify(payload.eventData)}::jsonb` : null,
    });

    return corsJson({ success: true });
  } catch (error: unknown) {
    console.error('Analytics event beacon endpoint exception:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return corsJson({ error: message }, 500);
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
