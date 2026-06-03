import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, leads, videos, computeLeadDedupeKey } from '@framevid/db';

const leadPayloadSchema = z.object({
  fields: z.record(z.string().optional()).default({}),
  source: z.string().optional(),
  referrerDomain: z.string().optional(),
});

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

// Very small, best-effort in-memory rate limit (per server instance)
const rl = new Map<string, { count: number; resetAtMs: number }>();
function rateLimitOrThrow(key: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 20;

  const cur = rl.get(key);
  if (!cur || cur.resetAtMs <= now) {
    rl.set(key, { count: 1, resetAtMs: now + windowMs });
    return;
  }

  cur.count += 1;
  if (cur.count > limit) {
    const err: any = new Error('Too many requests');
    err.status = 429;
    throw err;
  }
}

function getIp(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

function normalizeEmailMaybe(payload: Record<string, string | undefined>) {
  const emailKey = Object.keys(payload).find((k) => k.toLowerCase() === 'email' || k.toLowerCase().includes('email'));
  const raw = emailKey ? payload[emailKey] : undefined;
  const norm = (raw || '').trim().toLowerCase();
  return norm || null;
}

export async function POST(req: NextRequest, { params }: { params: { videoId: string } }) {
  try {
    const { videoId } = params;
    if (!videoId) {
      return withCors(NextResponse.json({ error: 'Video ID is required', code: 'MISSING_PARAMS' }, { status: 400 }));
    }

    rateLimitOrThrow(`${getIp(req)}:${videoId}`);

    const body = await req.json();
    const parsed = leadPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      );
    }

    const payloadFields = parsed.data.fields || {};
    const source = parsed.data.source || 'player';
    const referrerDomain = parsed.data.referrerDomain || req.headers.get('origin') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) {
      return withCors(NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 }));
    }

    const settings: any = video.settings || {};
    if (!settings.formEnabled) {
      return withCors(
        NextResponse.json({ error: 'Form is not enabled for this video', code: 'FORM_DISABLED' }, { status: 400 })
      );
    }

    const fieldsDef: { id: string; name: string; type: string; required: boolean }[] =
      settings.formFields || [{ id: 'f_email', name: 'Email', type: 'email', required: true }];

    // Validate required fields by label and id (enterprise friendly)
    for (const f of fieldsDef) {
      if (!f.required) continue;
      const candidates = [f.id, f.name].filter(Boolean);
      const has = candidates.some((k) => {
        const v = payloadFields[k];
        return typeof v === 'string' && v.trim().length > 0;
      });
      if (!has) {
        return withCors(
          NextResponse.json(
            { error: `Missing required field: ${f.name || f.id}`, code: 'MISSING_REQUIRED_FIELD', fieldId: f.id },
            { status: 400 }
          )
        );
      }
    }

    const email = normalizeEmailMaybe(payloadFields);
    const dedupeKey = computeLeadDedupeKey({ workspaceId: video.workspaceId, videoId, email });

    // Dedupe: if a lead already exists for this key, treat as success.
    const [existing] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.dedupeKey, dedupeKey), eq(leads.videoId, videoId)))
      .limit(1);

    if (!existing) {
      await db.insert(leads).values({
        workspaceId: video.workspaceId,
        videoId,
        email,
        payload: payloadFields,
        source,
        referrerDomain,
        userAgent,
        dedupeKey,
      });
    }

    // Device unlock (v1): caller persists locally. Server just returns a stable key.
    return withCors(
      NextResponse.json({
        ok: true,
        unlock: {
          key: dedupeKey,
          ttlSeconds: 60 * 60 * 24 * 365,
        },
      })
    );
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const code = status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR';
    return withCors(NextResponse.json({ error: err?.message || 'Internal Server Error', code }, { status }));
  }
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

