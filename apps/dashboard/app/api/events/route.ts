import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    let payload: any;
    
    // beacon payload can be passed as raw string in body
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const rawText = await req.text();
      payload = JSON.parse(rawText);
    }

    // Log events to stdout for local dev testing
    console.log(`[Analytics Event - Beacon Log] received:`, {
      videoId: payload.videoId,
      eventType: payload.eventType,
      progressPct: payload.progressPct,
      trackingLabel: payload.trackingLabel,
      referrerDomain: payload.referrerDomain,
      device: payload.deviceType,
      timestamp: payload.timestamp,
    });

    // Write to postgres database locally
    try {
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
        eventData: payload.eventData,
      });
    } catch (err) {
      console.error('Database logging error:', err);
    }

    const response = NextResponse.json({ success: true });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;

  } catch (error: any) {
    console.error('Analytics event beacon endpoint exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// OPTIONS CORS Preflight handler
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
