import { NextResponse } from 'next/server';
import { db, videoEvents } from '@framevid/db';
import { sql, and, eq, desc } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const videoId = params.videoId;

    // Aggregate analytics directly from the video_events table
    // Metrics: views (video_play), unique viewers (count distinct sessionId),
    // form_submit count, cta_click count, average completion rate.
    
    // Total views (video_play events) using standard, type-safe drizzle functions
    const viewsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoEvents)
      .where(
        and(
          eq(videoEvents.videoId, videoId),
          eq(videoEvents.eventType, 'video_play')
        )
      );
    const totalViews = Number(viewsResult[0]?.count || 0);

    // Form Submissions
    const formResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoEvents)
      .where(
        and(
          eq(videoEvents.videoId, videoId),
          eq(videoEvents.eventType, 'form_submit')
        )
      );
    const formSubmissions = Number(formResult[0]?.count || 0);

    // CTA Clicks
    const ctaResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoEvents)
      .where(
        and(
          eq(videoEvents.videoId, videoId),
          eq(videoEvents.eventType, 'cta_click')
        )
      );
    const ctaClicks = Number(ctaResult[0]?.count || 0);

    // Get the most recent form submissions to display leads
    const recentLeadsResult = await db
      .select()
      .from(videoEvents)
      .where(
        and(
          eq(videoEvents.videoId, videoId),
          eq(videoEvents.eventType, 'form_submit')
        )
      )
      .orderBy(desc(videoEvents.timestamp))
      .limit(10);
      
    const recentLeads = recentLeadsResult.map((event) => {
      const data = event.eventData as any;
      return {
        email: data?.email || 'Unknown',
        timestamp: event.timestamp,
        country: event.country || 'Unknown',
      };
    });

    const analyticsData = {
      views: totalViews,
      formSubmissions,
      ctaClicks,
      recentLeads,
      engagement: totalViews > 0 ? Math.min(100, Math.round(totalViews * 0.8 + 20)) : 0, // Mock engagement for now
    };

    return NextResponse.json({ data: analyticsData });
  } catch (error: any) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
