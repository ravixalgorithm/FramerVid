import { NextResponse } from 'next/server';
import { db, videoEvents, videos } from '@framevid/db';
import { sql, and, eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '../../../../lib/auth';
import { assertWorkspaceAccess } from '../../../../lib/workspace-access';
import { getAudienceBreakdown, getRetentionSeries } from '../../../../lib/analytics-queries';
import { getFrictionData } from '../../../../lib/friction-analysis';

export async function GET(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const videoId = params.videoId;
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) {
      return NextResponse.json({ error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const membership = await assertWorkspaceAccess(user.id, video.workspaceId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const viewsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoEvents)
      .where(and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'video_play')));
    const totalViews = Number(viewsResult[0]?.count || 0);

    const formResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoEvents)
      .where(and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'form_submit')));
    const formSubmissions = Number(formResult[0]?.count || 0);

    const ctaResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoEvents)
      .where(and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'cta_click')));
    const ctaClicks = Number(ctaResult[0]?.count || 0);

    const recentLeadsResult = await db
      .select()
      .from(videoEvents)
      .where(and(eq(videoEvents.videoId, videoId), eq(videoEvents.eventType, 'form_submit')))
      .orderBy(desc(videoEvents.timestamp))
      .limit(10);

    const recentLeads = recentLeadsResult.map((event) => {
      const data = event.eventData as { email?: string };
      return {
        email: data?.email || 'Unknown',
        timestamp: event.timestamp,
        country: event.country || 'Unknown',
      };
    });

    const retention = await getRetentionSeries(
      videoId,
      video.durationSeconds ? Number(video.durationSeconds) : undefined
    );

    const avgRetention =
      retention.retentionPct.length > 0
        ? Math.round(
            retention.retentionPct.reduce((a: number, b: number) => a + b, 0) / retention.retentionPct.length
          )
        : 0;

    let friction = null;
    try {
      friction = await getFrictionData(videoId, retention);
    } catch (frictionErr) {
      console.warn('Friction analysis skipped:', frictionErr);
    }

    const audience = await getAudienceBreakdown(videoId);

    return NextResponse.json({
      data: {
        views: totalViews,
        formSubmissions,
        ctaClicks,
        recentLeads,
        engagement: avgRetention,
        retention,
        friction,
        audience,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch analytics:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
